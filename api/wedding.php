<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

try {
    $conn = db();
    $groupId = isset($_GET['group']) ? $_GET['group'] : null;
    $token = $_GET['token'] ?? null;
    $name = $_GET['name'] ?? null;

    $group = null;

    if ($name) {
        // Try to find the group by guest name first (looking up group_id in guests_final)
        $cleanName = preg_replace('/\s+/', ' ', trim((string)$name));
        $search = "%" . $cleanName . "%";
        $guestSql = "SELECT group_id FROM guests_final "
            . "WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE LOWER(?) "
            . "LIMIT 1";
            
        $guestStmt = $conn->prepare($guestSql);
        $guestStmt->bind_param("s", $search);
        $guestStmt->execute();
        $guestResult = $guestStmt->get_result();
        $guestRow = $guestResult->fetch_assoc();
        
        if ($guestRow) {
            $groupId = $guestRow['group_id'];
        } else {
             // If not found in guests, try invitation_name in groups_final directly
             $group = fetchOneRow($conn, 'SELECT * FROM groups_final WHERE invitation_name = ?', 's', [$cleanName]);
             if ($group) {
                 $groupId = $group['group_id'];
             }
        }
    }

    if (!$group) {
        if ($token) {
            $group = fetchOneRow($conn, 'SELECT * FROM groups_final WHERE qr_token = ?', 's', [$token]);
        } else if ($groupId) {
            $group = fetchOneRow($conn, 'SELECT * FROM groups_final WHERE group_id = ?', 'i', [(int)$groupId]);
        } else {
            // Default fallback
            $group = fetchOneRow($conn, 'SELECT * FROM groups_final WHERE group_id = 1', '', []);
        }
    }

    if (!$group) {
        jsonResponse(['error' => 'Guest group not found'], 404);
    }

    $actualId = (int)$group['group_id'];
    $guests = fetchAllRows($conn, 'SELECT * FROM guests_final WHERE group_id = ?', 'i', [$actualId]);

    jsonResponse([
        'couple' => [
            'groomName' => 'Jodie', 'groomLastName' => 'Setiawan',
            'brideName' => 'Justine', 'brideLastName' => 'Joy',
            'groomParents' => 'SON OF MR. HARLY SETIAWAN & MRS. SUSAN DARMANTO',
            'brideParents' => 'DAUGHTER OF MR. RONY SUTRISNO & MRS. VIVI ISWANTI',
            'hashtag' => '#JODohnyaJJ', 'verse' => 'Matthew 19:6'
        ],
        'invitation' => [
            'groupId' => $actualId,
            'validPax' => (int)($group['max_pax'] ?? count($guests)),
            'guestGroupName' => $group['invitation_name'] ?? '',
            'guests' => array_map(fn($g) => [
                'id' => (int)$g['guest_id'],
                'designation' => $g['designation'],
                'firstName' => $g['first_name'],
                'lastName' => $g['last_name'],
                'attendance' => $g['guest_rsvp_status'],
                'tableNo' => (int)($group['table_no'] ?? 0)
            ], $guests)
        ],
        'integration' => ['modeLabel' => 'Live Mode'],
        // Static schedule as fallback
        'schedule' => [
            ['time' => '09:00 WITA', 'title' => 'Holy Matrimony', 'venue' => 'Hotel Mercure', 'location' => 'Ballroom 5'],
            ['time' => '18:30 WITA', 'title' => 'Wedding Reception', 'venue' => 'Hotel Mercure', 'location' => 'Ballroom 3']
        ],
        'weddingDate' => ['dateText' => '10.10.26', 'weekday' => 'Saturday, '],
        'rsvp' => ['deadline' => 'Sat, 26/09/26'],
        'contact' => ['display' => 'wa.me/6281389834762', 'whatsAppUrl' => 'https://wa.me/6281389834762'],
        'responses' => [
            'accepted' => ['title' => 'Thank you!', 'body' => "We can't wait to see you!"],
            'declined' => ['title' => 'We will miss you!', 'body' => 'Thank you for your love.']
        ],
        'qr' => ['message' => 'Screenshot this for check-in.']
    ]);
} catch (Throwable $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
