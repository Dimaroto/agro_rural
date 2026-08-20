<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// OpenSSL 3 + PFX A1 brasileiro (precisa do provider legacy antes de carregar o framework).
$opensslCnf = dirname(__DIR__).DIRECTORY_SEPARATOR.'openssl-legacy.cnf';
if (is_file($opensslCnf)) {
    putenv('OPENSSL_CONF='.$opensslCnf);
    $_ENV['OPENSSL_CONF'] = $opensslCnf;
    $_SERVER['OPENSSL_CONF'] = $opensslCnf;
}
$opensslModules = dirname(PHP_BINARY).DIRECTORY_SEPARATOR.'extras'.DIRECTORY_SEPARATOR.'ssl';
if (is_dir($opensslModules)) {
    putenv('OPENSSL_MODULES='.$opensslModules);
    $_ENV['OPENSSL_MODULES'] = $opensslModules;
    $_SERVER['OPENSSL_MODULES'] = $opensslModules;
}

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
