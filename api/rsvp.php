<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);

try {
    $conn = db();
    $input = getJsonInput();
    $attendance = $input['attendance'] ?? 'no';
    $groupId = (int)($input['groupId'] ?? 0);
    $guestIds = $input['guestIds'] ?? [];

    $conn->begin_transaction();

    // Update Group Status
    $status = ($attendance === 'yes') ? 'Yes' : 'No';
    runQuery($conn, "UPDATE groups_final SET group_rsvp_status = ?, rsvp_timestamp = NOW() WHERE group_id = ?", 'si', [$status, $groupId]);

    // Update individual guests
    if ($attendance === 'yes') {
        runQuery($conn, "UPDATE guests_final SET guest_rsvp_status = 'No' WHERE group_id = ?", 'i', [$groupId]);
        foreach ($guestIds as $id) {
            runQuery($conn, "UPDATE guests_final SET guest_rsvp_status = 'Yes' WHERE guest_id = ?", 'i', [(int)$id]);
        }
    } else {
        runQuery($conn, "UPDATE guests_final SET guest_rsvp_status = 'No' WHERE group_id = ?", 'i', [$groupId]);
    }

    $conn->commit();
    jsonResponse(['success' => true, 'message' => 'RSVP Saved']);
} catch (Throwable $e) {
    if (isset($conn)) $conn->rollback();
    jsonResponse(['error' => $e->getMessage()], 500);
}