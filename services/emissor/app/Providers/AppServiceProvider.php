<?php

namespace App\Providers;

use App\Support\WritableTemp;
use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // TMP/TEMP graváveis (NFePHP usa sys_get_temp_dir para certs SOAP)
        try {
            WritableTemp::applyEnvironment();
        } catch (\Throwable) {
            // ignore
        }

        // PFX A1 brasileiros costumam exigir o provider legacy do OpenSSL 3.
        $cnf = base_path('openssl-legacy.cnf');
        if (is_file($cnf)) {
            putenv('OPENSSL_CONF='.$cnf);
            $_ENV['OPENSSL_CONF'] = $cnf;
            $_SERVER['OPENSSL_CONF'] = $cnf;
        }

        $modules = dirname(PHP_BINARY).DIRECTORY_SEPARATOR.'extras'.DIRECTORY_SEPARATOR.'ssl';
        if (is_dir($modules) && (
            is_file($modules.DIRECTORY_SEPARATOR.'legacy.dll')
            || is_file($modules.DIRECTORY_SEPARATOR.'legacy.so')
        )) {
            putenv('OPENSSL_MODULES='.$modules);
            $_ENV['OPENSSL_MODULES'] = $modules;
            $_SERVER['OPENSSL_MODULES'] = $modules;
        }

        // artisan serve só repassa variáveis da whitelist ao php -S filho.
        foreach (['OPENSSL_CONF', 'OPENSSL_MODULES', 'TMP', 'TEMP', 'TMPDIR'] as $var) {
            if (! in_array($var, ServeCommand::$passthroughVariables, true)) {
                ServeCommand::$passthroughVariables[] = $var;
            }
        }

        // Form/redirect devem usar o host da requisicao (127.0.0.1), nao localhost do APP_URL.
        // Senao o WebView do app posta/redireciona para outro host e o PFX "nao sobe".
        if (! $this->app->runningInConsole()) {
            $this->app->booted(function () {
                $request = request();
                if ($request && $request->getHost() !== '') {
                    URL::forceRootUrl($request->getSchemeAndHttpHost());
                }
            });
        }
    }
}
