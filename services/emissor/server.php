<?php

/**
 * Router do PHP built-in server (usado pelo start-local.bat).
 * Evita `artisan serve`, que no Windows falha quando o path do usuário
 * tem acentos (PHP_BINARY com encoding quebrado ao spawnar o filho).
 */

$publicPath = getcwd();

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? ''
);

if ($uri !== '/' && file_exists($publicPath.$uri)) {
    return false;
}

require_once $publicPath.'/index.php';
