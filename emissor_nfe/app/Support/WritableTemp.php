<?php

namespace App\Support;

/**
 * Diretório temporário gravável no Windows (evita mkdir(): Permission denied
 * do NFePHP em sys_get_temp_dir() / raiz do drive).
 */
final class WritableTemp
{
    public static function root(): string
    {
        $candidates = [];

        $local = getenv('LOCALAPPDATA') ?: ($_SERVER['LOCALAPPDATA'] ?? '');
        if (is_string($local) && $local !== '') {
            $candidates[] = rtrim($local, '\\/').DIRECTORY_SEPARATOR
                .'Agro Rural Zortea'.DIRECTORY_SEPARATOR.'emissor'.DIRECTORY_SEPARATOR.'tmp';
        }

        $candidates[] = storage_path('app'.DIRECTORY_SEPARATOR.'tmp');
        $candidates[] = sys_get_temp_dir();

        foreach ($candidates as $dir) {
            if (self::ensureWritable($dir)) {
                return $dir;
            }
        }

        return sys_get_temp_dir();
    }

    public static function forNfephp(string $cnpjOrCpf): string
    {
        $digits = preg_replace('/\D/', '', $cnpjOrCpf) ?: 'certs';
        $dir = self::root().DIRECTORY_SEPARATOR.'nfephp'.DIRECTORY_SEPARATOR.$digits;
        self::ensureWritable($dir);

        return $dir.DIRECTORY_SEPARATOR;
    }

    public static function applyEnvironment(): string
    {
        $root = self::root();
        putenv('TMP='.$root);
        putenv('TEMP='.$root);
        putenv('TMPDIR='.$root);
        $_ENV['TMP'] = $root;
        $_ENV['TEMP'] = $root;
        $_ENV['TMPDIR'] = $root;
        $_SERVER['TMP'] = $root;
        $_SERVER['TEMP'] = $root;
        $_SERVER['TMPDIR'] = $root;

        return $root;
    }

    private static function ensureWritable(string $dir): bool
    {
        if ($dir === '' || $dir === '/' || $dir === '\\') {
            return false;
        }
        if (! is_dir($dir)) {
            if (! @mkdir($dir, 0777, true) && ! is_dir($dir)) {
                return false;
            }
        }

        $probe = $dir.DIRECTORY_SEPARATOR.'.mb_write_test_'.getmypid();
        $ok = @file_put_contents($probe, 'ok') !== false;
        if ($ok) {
            @unlink($probe);
        }

        return $ok;
    }
}
