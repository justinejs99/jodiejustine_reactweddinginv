<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once 'db.php';

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

// Update the group record with check-in info
// We assume actual_adult, actual_kids, gift_count, souvenir_count, titipan_gift_count columns exist or we just mark checked_in
$stmt = $conn->prepare("UPDATE groups_final SET checked_in = 1, actual_adult = ?, actual_kids = ? WHERE id = ?");
$stmt->bind_param("iii", $adultCount, $kidsCount, $groupId);

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Database update failed']);
}
