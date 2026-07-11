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

try {
    // 1. Check if db.php exists
    if (!file_exists('db.php')) {
        throw new Exception("Backend configuration error: db.php missing on server.");
    }
    
    require_once 'db.php';

    // 2. Check if connection variable exists
    if (!isset($conn) || !$conn) {
        throw new Exception("Database connection failed.");
    }

    $id = isset($_GET['id']) ? $_GET['id'] : null;
    $name = isset($_GET['name']) ? $_GET['name'] : null;

    if (!$id && !$name) {
        throw new Exception("Missing group ID or name.");
    }

    if ($id) {
        // Search by ID or QR Token
        $stmt = $conn->prepare("SELECT id, invitation_name, table_no, adult_pax, kids_pax, checked_in FROM groups_final WHERE id = ? OR qr_token = ?");
        if (!$stmt) throw new Exception("Database query error (ID): " . $conn->error);
        $stmt->bind_param("ss", $id, $id);
    } else {
        // Search by name - Case Insensitive & Trimmed
        $cleanName = trim($name);
        $search = "%" . $cleanName . "%";
        $stmt = $conn->prepare("SELECT id, invitation_name, table_no, adult_pax, kids_pax, checked_in FROM groups_final WHERE LOWER(invitation_name) LIKE LOWER(?)");
        if (!$stmt) throw new Exception("Database query error (Name): " . $conn->error);
        $stmt->bind_param("s", $search);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => "Guest '$name' not found in database."]);
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
        'hint' => 'Check if table "groups_final" exists and has columns: id, invitation_name, table_no, adult_pax, kids_pax, checked_in, qr_token'
    ]);
}

