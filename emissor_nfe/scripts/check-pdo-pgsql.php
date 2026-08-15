<?php
// Usado por start-local.bat — nao gerar este arquivo via echo no cmd (parenteses quebram).
exit(in_array('pgsql', PDO::getAvailableDrivers(), true) ? 0 : 1);
