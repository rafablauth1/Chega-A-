/**
 * Deixa o app baixar e abrir o instalador do APK novo sozinho (aviso "Nova versão disponível").
 * Só serve para quem instalou o APK por fora da loja. O Android sempre pergunta "Instalar?" e,
 * na primeira vez, pede para liberar "instalar apps desta fonte" para o Vaia Aí.
 *
 * PLAY STORE: a Google proíbe esta permissão em app da loja (a loja é quem atualiza).
 * No build da Play Store, tire "./plugins/withApkInstaller" de app.json (e o aviso de APK
 * deixa de fazer sentido: a loja atualiza sozinha).
 */
const { AndroidConfig } = require('expo/config-plugins');

module.exports = function withApkInstaller(config) {
  return AndroidConfig.Permissions.withPermissions(config, ['android.permission.REQUEST_INSTALL_PACKAGES']);
};
