import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  ExternalLink,
  X,
  AlertCircle,
  CheckCircle2,
  Copy,
  Layers,
  ArrowRight,
  Server,
} from 'lucide-react';
import { SiglonAuthState } from '../types/siglon';

interface SiglonAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authState: SiglonAuthState;
  onLogin: (username: string, password: string) => Promise<boolean>;
  onApplyManualToken: (token: string) => Promise<boolean>;
  onLogout: () => void;
  isLoading: boolean;
  authError: string | null;
  onFetchProtectedLayers: () => void;
}

export const SiglonAuthModal: React.FC<SiglonAuthModalProps> = ({
  isOpen,
  onClose,
  authState,
  onLogin,
  onApplyManualToken,
  onLogout,
  isLoading,
  authError,
  onFetchProtectedLayers,
}) => {
  const [method, setMethod] = useState<'credentials' | 'token' | 'oauth'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [oauthRedirectUrl, setOauthRedirectUrl] = useState('');

  const OAUTH_URL =
    'https://geo.londrina.pr.gov.br/portal/sharing/oauth2/authorize?canHandleCrossOrgSignin=true&client_id=arcgisonline&response_type=code&state=%7B%22portalUrl%22%3A%22https%3A%2F%2Fgeo.londrina.pr.gov.br%2Fportal%22%2C%22uid%22%3A%224svn7xS9vZDpbFIJtjMKZplv7XrleaW5ikX2Lv2VBWc%22%7D&expiration=20160&redirect_uri=https%3A%2F%2Fgeo.londrina.pr.gov.br%2Fportal%2Fapps%2Fwebappviewer%2Findex.html%3Fid%3D6e505befb3be4535a772c698502233f9&redirectToUserOrgUrl=true&code_challenge=MM0Sr91ihe6Jzx6hDSnBMGNfGd1F7xWxGLN7pgA7iek&code_challenge_method=S256';

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    const success = await onLogin(username.trim(), password.trim());
    if (success) {
      setPassword('');
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await onApplyManualToken(manualToken.trim());
  };

  const handleOauthExtract = async () => {
    if (!oauthRedirectUrl.trim()) return;
    try {
      const url = new URL(oauthRedirectUrl.trim());
      const token =
        url.searchParams.get('token') ||
        url.searchParams.get('code') ||
        url.hash.replace(/^#/, '').split('&').find((p) => p.startsWith('access_token='))?.split('=')[1];

      if (token) {
        await onApplyManualToken(token);
      } else {
        await onApplyManualToken(oauthRedirectUrl.trim());
      }
    } catch (_) {
      // If it's directly a raw token string
      await onApplyManualToken(oauthRedirectUrl.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Autenticação SIGLON / Londrina</h2>
              <p className="text-xs text-sky-200">
                Acesso à Base Cartográfica e Fiscalização (App ID: 6e505bef)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative notice */}
        <div className="p-4 bg-sky-50 border-b border-sky-100 text-xs text-sky-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              O link informado é uma aplicação protegida do Portal ArcGIS da Prefeitura.
            </p>
            <p className="text-slate-600">
              Para carregar as camadas restritas de <strong>Base Cartográfica (BBB_Cartografico)</strong> e{' '}
              <strong>Fiscalização (CCC_SMF)</strong> do link, conecte suas credenciais municipais ou informe um token de acesso.
            </p>
          </div>
        </div>

        {/* Current Auth Status Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                authState.isAuthenticated ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500 ring-4 ring-amber-100'
              }`}
            />
            <div>
              <div className="font-bold text-xs text-slate-800">
                {authState.isAuthenticated
                  ? `Conectado ao SIGLON: ${authState.username || 'Token Ativo'}`
                  : 'Modo Público (Acesso às Camadas Abertas do SIGLON)'}
              </div>
              <div className="text-[11px] text-slate-500">
                {authState.isAuthenticated
                  ? 'Acesso liberado a serviços protegidos'
                  : 'Serviços públicos Gerais/BCarSiglon e LimSmfAbrangFiscal ativos'}
              </div>
            </div>
          </div>

          {authState.isAuthenticated && (
            <button
              onClick={onLogout}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 bg-white border border-rose-200 rounded-lg shadow-sm transition"
            >
              Desconectar
            </button>
          )}
        </div>

        {/* Tabs for Auth Methods */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-4 text-xs font-semibold shrink-0">
          <button
            onClick={() => setMethod('credentials')}
            className={`py-2.5 px-3 border-b-2 transition ${
              method === 'credentials'
                ? 'border-sky-600 text-sky-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Login Prefeitura
          </button>
          <button
            onClick={() => setMethod('oauth')}
            className={`py-2.5 px-3 border-b-2 transition ${
              method === 'oauth'
                ? 'border-sky-600 text-sky-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Link OAuth Oficial
          </button>
          <button
            onClick={() => setMethod('token')}
            className={`py-2.5 px-3 border-b-2 transition ${
              method === 'token'
                ? 'border-sky-600 text-sky-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Inserir Token Manual
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* METHOD 1: CREDENTIALS */}
          {method === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
              <p className="text-xs text-slate-600">
                Insira o usuário e senha cadastrados no sistema corporativo ou intranet do SIGLON (Prefeitura de Londrina):
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Usuário SIGLON:
                </label>
                <input
                  type="text"
                  placeholder="Ex: matricula ou login corporativo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Senha:
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoading ? 'Conectando ao SIGLON...' : 'Autenticar e Desbloquear Camadas'}</span>
              </button>
            </form>
          )}

          {/* METHOD 2: OAUTH OFFICIAL LINK */}
          {method === 'oauth' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <p className="font-semibold text-slate-800">
                  Passo 1: Efetuar login no portal oficial de Londrina
                </p>
                <p className="text-slate-600">
                  Clique no botão abaixo para abrir a tela de login OAuth oficial no portal{' '}
                  <code className="text-sky-700 font-mono">geo.londrina.pr.gov.br</code>:
                </p>
                <a
                  href={OAUTH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-3.5 rounded-lg text-xs transition shadow-sm"
                >
                  <ExternalLink className="w-4 h-4 text-sky-400" />
                  <span>Abrir Tela de Autorização SIGLON</span>
                </a>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-xs text-slate-800">
                  Passo 2: Cole a URL de redirecionamento ou código obtido
                </p>
                <input
                  type="text"
                  placeholder="https://geo.londrina.pr.gov.br/portal/apps/webappviewer/... ou código"
                  value={oauthRedirectUrl}
                  onChange={(e) => setOauthRedirectUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleOauthExtract}
                  disabled={isLoading || !oauthRedirectUrl.trim()}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Validar e Vincular Sessão</span>
                </button>
              </div>
            </div>
          )}

          {/* METHOD 3: MANUAL TOKEN */}
          {method === 'token' && (
            <form onSubmit={handleTokenSubmit} className="space-y-3.5">
              <p className="text-xs text-slate-600">
                Se você já gerou um token de acesso através do ArcGIS Portal Directory (ou ferramentas de desenvolvedor), cole-o abaixo:
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Token ArcGIS:
                </label>
                <textarea
                  rows={3}
                  placeholder="Cole aqui o token de autenticação..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>{isLoading ? 'Verificando...' : 'Aplicar Token e Desbloquear'}</span>
              </button>
            </form>
          )}

          {/* Link to view app directly */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>Aplicação WebApp: 6e505befb3be4535a772c698502233f9</span>
            <a
              href="https://geo.londrina.pr.gov.br/portal/apps/webappviewer/index.html?id=6e505befb3be4535a772c698502233f9"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Ver WebApp Original</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
