<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

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

    $idCol = pickColumn($columns, ['id', 'group_id', 'groupid'], 'id');
    $checkedCol = pickColumn($columns, ['checked_in', 'is_checked_in', 'checkin_status'], 'checked in');
    $actualAdultCol = pickColumn($columns, ['checked_in_adults', 'actual_adult', 'checked_adult', 'adult_actual'], 'actual adult', false);
    $actualKidsCol = pickColumn($columns, ['checked_in_kids', 'actual_kids', 'checked_kids', 'kids_actual'], 'actual kids', false);
    $giftCol = pickColumn($columns, ['angbao_count', 'gift_count'], 'gift count', false);
    $souvenirCol = pickColumn($columns, ['souvenir_given', 'souvenir_count'], 'souvenir count', false);

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['groupId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }

    $groupId = $data['groupId'];
    $adultCount = isset($data['adultCount']) ? (int)$data['adultCount'] : 0;
    $kidsCount = isset($data['kidsCount']) ? (int)$data['kidsCount'] : 0;
    $giftCount = isset($data['giftCount']) ? (int)$data['giftCount'] : 0;
    $souvenirCount = isset($data['souvenirCount']) ? (int)$data['souvenirCount'] : 0;
    $titipanGiftCount = isset($data['titipanGiftCount']) ? (int)$data['titipanGiftCount'] : 0;

    // Build update statement from available columns in groups_final.
    $setParts = ["{$checkedCol} = 1"];
    $params = [];
    $types = '';

    if ($actualAdultCol !== null) {
        $setParts[] = "{$actualAdultCol} = ?";
        $params[] = $adultCount;
        $types .= 'i';
    }

    if ($actualKidsCol !== null) {
        $setParts[] = "{$actualKidsCol} = ?";
        $params[] = $kidsCount;
        $types .= 'i';
    }

    if ($giftCol !== null) {
        $setParts[] = "{$giftCol} = ?";
        $params[] = $giftCount;
        $types .= 'i';
    }

    if ($souvenirCol !== null) {
        $setParts[] = "{$souvenirCol} = ?";
        $params[] = $souvenirCount;
        $types .= 'i';
    }

    $params[] = (int)$groupId;
    $types .= 'i';

    $sql = "UPDATE groups_final SET " . implode(', ', $setParts) . " WHERE {$idCol} = ?";

    if ($conn instanceof mysqli) {
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception('Database query error: ' . $conn->error);
        }

        $stmt->bind_param($types, ...$params);

        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Database update failed']);
        }
    } else {
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception('Database query error.');
        }
        $ok = $stmt->execute($params);
        if ($ok) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Database update failed']);
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
