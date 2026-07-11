<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
require __DIR__ . '/db.php';

try {
    echo "Connecting...<br>";
    $conn = db();
    echo "Connection Successful!<br>";

    // Check your actual table name
    $res = $conn->query("SELECT COUNT(*) as count FROM groups_final");
    $row = $res->fetch_assoc();
    echo "Found " . $row['count'] . " groups in 'groups_final' table.<br>";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}