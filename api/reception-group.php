<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'db.php';

$id = isset($_GET['id']) ? $_GET['id'] : null;
$name = isset($_GET['name']) ? $_GET['name'] : null;

if (!$id && !$name) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing identifier or name']);
    exit;
}

if ($id) {
    // Try search by ID or QR Token
    $stmt = $conn->prepare("SELECT id, invitation_name, table_no, adult_pax, kids_pax, checked_in FROM groups_final WHERE id = ? OR qr_token = ?");
    $stmt->bind_param("ss", $id, $id);
} else {
    // Search by invitation name - case insensitive and trimmed
    $search = "%" . trim($name) . "%";
    $stmt = $conn->prepare("SELECT id, invitation_name, table_no, adult_pax, kids_pax, checked_in FROM groups_final WHERE LOWER(invitation_name) LIKE LOWER(?)");
    $stmt->bind_param("s", $search);
}

$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Guest not found']);
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
