/**
 * Assina o APK/AAB de release com a chave PRÓPRIA do app (não a chave de teste pública do Expo).
 *
 * A chave e as senhas NUNCA ficam no repositório. Elas vêm do arquivo do PC de quem compila:
 *   %USERPROFILE%\.gradle\gradle.properties
 *     VAIAAI_UPLOAD_STORE_FILE=C:/caminho/vaiaai-release.keystore
 *     VAIAAI_UPLOAD_KEY_ALIAS=vaiaai
 *     VAIAAI_UPLOAD_STORE_PASSWORD=...
 *     VAIAAI_UPLOAD_KEY_PASSWORD=...
 * Sem essas linhas, o build de release cai na chave de teste (só para desenvolvimento).
 * Na nuvem (EAS Build) a assinatura é gerenciada pelo Expo e este plugin não interfere.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// vaiaai-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;

    // 1. signingConfig "release" lida das propriedades do Gradle
    gradle = gradle.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        ${MARK}
        release {
            if (project.hasProperty('VAIAAI_UPLOAD_STORE_FILE')) {
                storeFile file(VAIAAI_UPLOAD_STORE_FILE)
                storePassword VAIAAI_UPLOAD_STORE_PASSWORD
                keyAlias VAIAAI_UPLOAD_KEY_ALIAS
                keyPassword VAIAAI_UPLOAD_KEY_PASSWORD
            }
        }`,
    );

    // 2. buildType release passa a usar a chave própria quando ela existir
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('VAIAAI_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
