<?php

$pdo = new PDO('mysql:host=127.0.0.1', 'root', '');
$pdo->exec('DROP DATABASE IF EXISTS hrneck_central_testing');
$pdo->exec('CREATE DATABASE hrneck_central_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

$prefix = 'hrneck_tenant_testing_';
$dbs = $pdo->query('SHOW DATABASES')->fetchAll(PDO::FETCH_COLUMN);
foreach ($dbs as $db) {
    if (str_starts_with((string) $db, $prefix)) {
        $pdo->exec('DROP DATABASE IF EXISTS `'.$db.'`');
    }
}

echo "reset ok\n";
