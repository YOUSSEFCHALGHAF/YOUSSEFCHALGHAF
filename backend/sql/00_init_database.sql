-- 1. Bases de données en UTF-8 complet (accents, emojis)
CREATE DATABASE IF NOT EXISTS smartqueue
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS smartqueue_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Utilisateur dédié à l'application (changez le mot de passe !)
CREATE USER IF NOT EXISTS 'smartqueue_user'@'localhost'
  IDENTIFIED BY 'SmartQueue2026Pass';

-- 3. Droits limités à ces deux bases
GRANT ALL PRIVILEGES ON smartqueue.*      TO 'smartqueue_user'@'localhost';
GRANT ALL PRIVILEGES ON smartqueue_test.* TO 'smartqueue_user'@'localhost';
FLUSH PRIVILEGES;

-- 4. Vérification
SHOW DATABASES LIKE 'smartqueue%';
SHOW GRANTS FOR 'smartqueue_user'@'localhost';