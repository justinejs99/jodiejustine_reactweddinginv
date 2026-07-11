<?php
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function db(): mysqli
{
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $conn = new mysqli(
        'localhost',
        'u491096763_justinejs',
        'Jodiejj_1010',
        'u491096763_JodieJJWedInv',
        3306
    );

    $conn->set_charset('utf8mb4');

    return $conn;
}

function fetchAllRows(mysqli $conn, string $sql, string $types = '', array $params = []): array
{
    $stmt = $conn->prepare($sql);

    if ($types !== '' && $params !== []) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    return $result->fetch_all(MYSQLI_ASSOC);
}

function fetchOneRow(mysqli $conn, string $sql, string $types = '', array $params = []): ?array
{
    $rows = fetchAllRows($conn, $sql, $types, $params);
    return $rows[0] ?? null;
}

function runQuery(mysqli $conn, string $sql, string $types = '', array $params = []): void
{
    $stmt = $conn->prepare($sql);

    if ($types !== '' && $params !== []) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
}