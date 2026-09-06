<?php
/* Custom phpMyAdmin configuration to fix Safari / HTTP session cookie issues */
$cfg['CookieSecure'] = false;
$cfg['CookieSameSite'] = 'Lax';
$cfg['SessionSavePath'] = '/sessions';
