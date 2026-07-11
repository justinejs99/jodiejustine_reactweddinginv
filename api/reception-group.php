<?php
/**
 * RECEPTION GROUP LOOKUP
 * Returns JSON error instead of HTML to avoid "Unexpected token '<'" errors.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Disable HTML error reporting
ini_set('display_errors', 0);
error_reporting(0);

function resolveDatabaseConnection() {
    $dbPath = __DIR__ . '/db.php';
    if (!file_exists($dbPath)) {
        throw new Exception('Backend configuration error: db.php missing on server.');
    }

    require_once $dbPath;

    // Preferred path for this project's db.php (function db(): mysqli)
    if (function_exists('db')) {
        $candidate = db();
        if ($candidate instanceof mysqli || $candidate instanceof PDO) {
            return $candidate;
        }
    }

    if (isset($GLOBALS['conn']) && ($GLOBALS['conn'] instanceof mysqli || $GLOBALS['conn'] instanceof PDO)) {
        return $GLOBALS['conn'];
    }

    if (isset($GLOBALS['mysqli']) && ($GLOBALS['mysqli'] instanceof mysqli || $GLOBALS['mysqli'] instanceof PDO)) {
        return $GLOBALS['mysqli'];
    }

    if (isset($GLOBALS['db']) && ($GLOBALS['db'] instanceof mysqli || $GLOBALS['db'] instanceof PDO)) {
        return $GLOBALS['db'];
    }

    if (isset($GLOBALS['database']) && ($GLOBALS['database'] instanceof mysqli || $GLOBALS['database'] instanceof PDO)) {
        return $GLOBALS['database'];
    }

    if (isset($GLOBALS['connection']) && ($GLOBALS['connection'] instanceof mysqli || $GLOBALS['connection'] instanceof PDO)) {
        return $GLOBALS['connection'];
    }

    if (function_exists('getDbConnection')) {
        $candidate = getDbConnection();
        if ($candidate instanceof mysqli || $candidate instanceof PDO) {
            return $candidate;
        }
    }

    if (function_exists('db_connect')) {
        $candidate = db_connect();
        if ($candidate instanceof mysqli || $candidate instanceof PDO) {
            return $candidate;
        }
    }

    if (function_exists('get_connection')) {
        $candidate = get_connection();
        if ($candidate instanceof mysqli || $candidate instanceof PDO) {
            return $candidate;
        }
    }

    if (function_exists('connectDB')) {
        $candidate = connectDB();
        if ($candidate instanceof mysqli || $candidate instanceof PDO) {
            return $candidate;
        }
    }

    foreach ($GLOBALS as $value) {
        if ($value instanceof mysqli || $value instanceof PDO) {
            return $value;
        }
    }

    throw new Exception('Database connection failed. No mysqli/PDO connection found from db.php.');
}

function getTableColumns($conn, string $table): array {
    $cols = [];

    if ($conn instanceof mysqli) {
        $result = $conn->query("SHOW COLUMNS FROM {$table}");
        if (!$result) {
            throw new Exception("Failed to inspect table {$table}: " . $conn->error);
        }
        while ($row = $result->fetch_assoc()) {
            $cols[] = $row['Field'];
        }
        return $cols;
    }

    $stmt = $conn->query("SHOW COLUMNS FROM {$table}");
    if (!$stmt) {
        throw new Exception("Failed to inspect table {$table}.");
    }
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $cols[] = $row['Field'];
    }
    return $cols;
}

function pickColumn(array $columns, array $candidates, string $label, bool $required = true): ?string {
    foreach ($candidates as $candidate) {
        if (in_array($candidate, $columns, true)) {
            return $candidate;
        }
    }

    if ($required) {
        throw new Exception("Missing expected {$label} column in groups_final.");
    }

    return null;
}

try {
    $conn = resolveDatabaseConnection();
    $columns = getTableColumns($conn, 'groups_final');
    $guestColumns = getTableColumns($conn, 'guests_final');

    $idCol = pickColumn($columns, ['id', 'group_id', 'groupid'], 'id');
    $nameCol = pickColumn($columns, ['invitation_name', 'group_name', 'name'], 'invitation name');
    $tableCol = pickColumn($columns, ['table_no', 'table_number', 'table'], 'table number');
    $adultCol = pickColumn($columns, ['adult_pax', 'adult', 'adult_count'], 'adult pax', false);
    $kidsCol = pickColumn($columns, ['kids_pax', 'kids', 'kids_count', 'children_pax'], 'kids pax', false);
    $checkedCol = pickColumn($columns, ['checked_in', 'is_checked_in', 'checkin_status'], 'checked in');
    $qrCol = pickColumn($columns, ['qr_token', 'qr_code', 'token'], 'qr token', false);

    $guestGroupIdCol = pickColumn($guestColumns, ['group_id', 'groupid', 'id_group'], 'group_id in guests_final');
    $guestFirstNameCol = pickColumn($guestColumns, ['first_name', 'firstname', 'first'], 'first_name in guests_final');
    $guestLastNameCol = pickColumn($guestColumns, ['last_name', 'lastname', 'last'], 'last_name in guests_final');

    $needsGuestJoin = ($adultCol === null || $kidsCol === null);

    $id = isset($_GET['id']) ? $_GET['id'] : null;
    $name = isset($_GET['name']) ? $_GET['name'] : null;

    if (!$id && !$name) {
        throw new Exception("Missing group ID or name.");
    }

    // Manual lookup: find guest by first+last name in guests_final, then map to group_id.
    if (!$id && $name) {
        $cleanName = preg_replace('/\s+/', ' ', trim((string)$name));
        $search = "%" . $cleanName . "%";
        $guestSql = "SELECT {$guestGroupIdCol} AS group_id FROM guests_final "
            . "WHERE LOWER(TRIM(CONCAT(COALESCE({$guestFirstNameCol}, ''), ' ', COALESCE({$guestLastNameCol}, '')))) LIKE LOWER(?) "
            . "LIMIT 1";

        if ($conn instanceof mysqli) {
            $guestStmt = $conn->prepare($guestSql);
            if (!$guestStmt) throw new Exception("Database query error (Guest name): " . $conn->error);
            $guestStmt->bind_param("s", $search);
            $guestStmt->execute();
            $guestResult = $guestStmt->get_result();
            $guestRow = $guestResult->fetch_assoc();
        } else {
            $guestStmt = $conn->prepare($guestSql);
            if (!$guestStmt) throw new Exception('Database query error (Guest name).');
            $guestStmt->execute([$search]);
            $guestRow = $guestStmt->fetch(PDO::FETCH_ASSOC);
        }

        if (!$guestRow || !isset($guestRow['group_id'])) {
            http_response_code(404);
            echo json_encode(['error' => 'Guest not found. Please try another name']);
            exit;
        }

        $id = (string)$guestRow['group_id'];
    }

    if ($id) {
        // Search by ID or QR Token
        $whereSqlJoined = "g.{$idCol} = ?";
        $whereSqlSimple = "{$idCol} = ?";
        if ($qrCol !== null) {
            $whereSqlJoined .= " OR g.{$qrCol} = ?";
            $whereSqlSimple .= " OR {$qrCol} = ?";
        }

        if ($needsGuestJoin) {
            $sql = "SELECT g.{$idCol} AS id, g.{$nameCol} AS invitation_name, g.{$tableCol} AS table_no, "
                . "SUM(CASE WHEN LOWER(COALESCE(gu.age_group, '')) = 'adult' THEN 1 ELSE 0 END) AS adult_pax, "
                . "SUM(CASE WHEN LOWER(COALESCE(gu.age_group, '')) IN ('kids', 'kid', 'child', 'children') THEN 1 ELSE 0 END) AS kids_pax, "
                . "g.{$checkedCol} AS checked_in "
                . "FROM groups_final g "
                . "LEFT JOIN guests_final gu ON gu.group_id = g.{$idCol} "
                . "WHERE {$whereSqlJoined} "
                . "GROUP BY g.{$idCol}, g.{$nameCol}, g.{$tableCol}, g.{$checkedCol}";
        } else {
            $sql = "SELECT {$idCol} AS id, {$nameCol} AS invitation_name, {$tableCol} AS table_no, {$adultCol} AS adult_pax, {$kidsCol} AS kids_pax, {$checkedCol} AS checked_in FROM groups_final WHERE {$whereSqlSimple}";
        }

        if ($conn instanceof mysqli) {
            $stmt = $conn->prepare($sql);
            if (!$stmt) throw new Exception("Database query error (ID): " . $conn->error);

            if ($qrCol !== null) {
                $stmt->bind_param("ss", $id, $id);
            } else {
                $stmt->bind_param("s", $id);
            }

            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
        } else {
            $stmt = $conn->prepare($sql);
            if (!$stmt) throw new Exception('Database query error (ID).');

            if ($qrCol !== null) {
                $stmt->execute([$id, $id]);
            } else {
                $stmt->execute([$id]);
            }

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
        }
    } else {
        throw new Exception('Unable to resolve group from request.');
    }

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Guest not found. Please try another name']);
        exit;
    }

    echo json_encode([
        'groupId' => (int)$row['id'],
        'groupName' => $row['invitation_name'],
        'tableNo' => $row['table_no'] ? (int)$row['table_no'] : null,
        'adultPax' => (int)$row['adult_pax'],
        'kidsPax' => (int)$row['kids_pax'],
        'checkedIn' => (bool)$row['checked_in']
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'hint' => 'Check if groups_final and guests_final exist, and that groups_final has group_id/invitation_name/table_no/checked_in while guests_final has group_id and age_group.'
    ]);
}

