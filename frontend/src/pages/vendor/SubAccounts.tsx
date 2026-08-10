import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserCog, Plus, Trash2, KeyRound, Power, ShieldCheck, X, Mail, Phone,
  Pencil, Loader2, Users, CheckCircle2, Copy, Eye, AlertTriangle, CalendarClock,
  Package, Search, ImageOff,
} from 'lucide-react';
import { vendorSubAccountsApi } from '../../lib/api';
import { VENDOR_HELPER_BASE } from '../../lib/dashboardBase';
import { normalizeSearch } from '../../utils/search';
import {
  SUB_PERMISSION_GROUPS,
  ALL_SUB_PERMISSIONS,
  dependentsOf,
  type SubPermission,
} from '../../lib/subAccountPermissions';
import toast from 'react-hot-toast';

/**
 * Sub-account management. The vendor creates helper logins here and decides,
 * action by action, what each of them can reach.
 *
 * The grants come from lib/subAccountPermissions; the backend matrix in
 * backend/src/lib/vendorSubAccount.ts is what enforces them.
 */

type AllowedModes = 'BOTH' | 'SELLER' | 'AFFILIATE';

interface SubAccount {
  id: number;
  uuid: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  isActive: boolean;
  mode: string;
  subAllowedModes: AllowedModes;
  subReadOnly: boolean;
  subAccessExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  permissions: Record<string, boolean>;
  /**
   * Products this assistant is pinned to. EMPTY means the whole catalogue — the
   * same rule the backend table uses, so an empty list is "everything", never
   * "nothing". The editor turns that into an explicit two-way choice rather than
   * showing an empty checklist that reads the wrong way round.
   */
  productIds: number[];
}

interface AssignableProduct {
  id: number;
  sku: string;
  name: string;
  status: string;
  retailPriceMad: number;
  imageUrl: string | null;
}

const MODE_LABELS: Record<AllowedModes, string> = {
  BOTH: 'Vendeur + Affilié',
  SELLER: 'Vendeur uniquement',
  AFFILIATE: 'Affilié uniquement',
};


const emptyPermissions = () =>
  Object.fromEntries(ALL_SUB_PERMISSIONS.map((k) => [k, false])) as Record<string, boolean>;

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function VendorSubAccounts() {
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [maxSubAccounts, setMaxSubAccounts] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SubAccount | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<SubAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [products, setProducts] = useState<AssignableProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    subAllowedModes: 'BOTH' as AllowedModes,
    subReadOnly: false,
    subAccessExpiresAt: '',
    permissions: emptyPermissions(),
    // The two-way choice the API's empty-means-everything convention needs
    // spelled out. `false` sends [], which the backend reads as no restriction.
    restrictProducts: false,
    productIds: [] as number[],
  });

  const load = async () => {
    try {
      const res = await vendorSubAccountsApi.list();
      setSubAccounts(res.data.data.subAccounts || []);
      setMaxSubAccounts(res.data.data.maxSubAccounts ?? 10);
    } catch {
      toast.error('Impossible de charger les sous-comptes.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetched the first time the editor opens rather than on mount: a vendor who
   * never restricts anyone should not pay for a catalogue query, and the list is
   * only ever read inside the modal.
   */
  const loadProducts = async () => {
    if (productsLoaded) return;
    try {
      const res = await vendorSubAccountsApi.assignableProducts();
      setProducts(res.data.data.products || []);
      setProductsLoaded(true);
    } catch {
      toast.error('Impossible de charger vos produits.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setProductSearch('');
    setForm({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      subAllowedModes: 'BOTH',
      subReadOnly: false,
      subAccessExpiresAt: '',
      permissions: { ...emptyPermissions(), subCanViewDashboard: true },
      restrictProducts: false,
      productIds: [],
    });
    setEditorOpen(true);
    loadProducts();
  };

  const openEdit = (sub: SubAccount) => {
    setEditing(sub);
    setProductSearch('');
    setForm({
      fullName: sub.fullName || '',
      email: sub.email || '',
      phone: sub.phone || '',
      password: '',
      subAllowedModes: sub.subAllowedModes || 'BOTH',
      subReadOnly: !!sub.subReadOnly,
      subAccessExpiresAt: toLocalInput(sub.subAccessExpiresAt),
      permissions: { ...emptyPermissions(), ...sub.permissions },
      restrictProducts: (sub.productIds || []).length > 0,
      productIds: [...(sub.productIds || [])],
    });
    setEditorOpen(true);
    loadProducts();
  };

  const toggleProduct = (id: number) =>
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((p) => p !== id)
        : [...f.productIds, id],
    }));

  const visibleProducts = products.filter((p) => {
    const q = normalizeSearch(productSearch);
    if (!q) return true;
    return normalizeSearch(`${p.name} ${p.sku}`).includes(q);
  });

  /**
   * Toggling a permission also settles anything that depends on it: switching a
   * parent off would otherwise leave orphan grants ticked that the backend will
   * refuse anyway, which reads as the screen lying about what was given.
   */
  const togglePermission = (key: SubPermission) =>
    setForm((f) => {
      const next = !f.permissions[key];
      const patch: Record<string, boolean> = { [key]: next };
      if (!next) for (const dep of dependentsOf(key)) patch[dep] = false;
      return { ...f, permissions: { ...f.permissions, ...patch } };
    });

  const setGroup = (keys: SubPermission[], value: boolean) =>
    setForm((f) => ({
      ...f,
      permissions: { ...f.permissions, ...Object.fromEntries(keys.map((k) => [k, value])) },
    }));

  const setAll = (value: boolean) =>
    setForm((f) => ({
      ...f,
      permissions: Object.fromEntries(ALL_SUB_PERMISSIONS.map((k) => [k, value])) as Record<string, boolean>,
    }));

  const grantedTotal = Object.values(form.permissions).filter(Boolean).length;

  const handleSave = async () => {
    if (!form.fullName.trim()) return toast.error('Le nom est requis.');
    if (!editing) {
      if (!form.email.trim()) return toast.error("L'email est requis.");
      if (form.password.length < 8) return toast.error('Le mot de passe doit faire au moins 8 caractères.');
    }
    // Sending an empty list would be read as "the whole catalogue", the opposite
    // of what picking "Produits sélectionnés" and choosing none looks like.
    if (form.restrictProducts && form.productIds.length === 0) {
      return toast.error('Sélectionnez au moins un produit, ou choisissez « Tout le catalogue ».');
    }

    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || undefined,
      subAllowedModes: form.subAllowedModes,
      subReadOnly: form.subReadOnly,
      subAccessExpiresAt: form.subAccessExpiresAt ? new Date(form.subAccessExpiresAt).toISOString() : null,
      permissions: form.permissions,
      productIds: form.restrictProducts ? form.productIds : [],
    };

    setSaving(true);
    try {
      if (editing) {
        await vendorSubAccountsApi.update(editing.uuid, payload);
        toast.success('Sous-compte mis à jour.');
      } else {
        await vendorSubAccountsApi.create({
          ...payload,
          email: form.email.trim(),
          password: form.password,
        });
        toast.success('Sous-compte créé.');
      }
      setEditorOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (sub: SubAccount) => {
    try {
      await vendorSubAccountsApi.setStatus(sub.uuid, !sub.isActive);
      toast.success(sub.isActive ? 'Sous-compte suspendu.' : 'Sous-compte réactivé.');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action impossible.');
    }
  };

  const handleDelete = async (sub: SubAccount) => {
    if (!window.confirm(`Supprimer définitivement le sous-compte de ${sub.fullName || sub.email} ?`)) return;
    try {
      await vendorSubAccountsApi.remove(sub.uuid);
      toast.success('Sous-compte supprimé.');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Suppression impossible.');
    }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 8) return toast.error('Le mot de passe doit faire au moins 8 caractères.');
    setSaving(true);
    try {
      await vendorSubAccountsApi.setPassword(passwordTarget!.uuid, newPassword);
      toast.success('Mot de passe mis à jour.');
      setPasswordTarget(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  };

  const grantedCount = (sub: SubAccount) => Object.values(sub.permissions || {}).filter(Boolean).length;
  const isExpired = (sub: SubAccount) =>
    !!sub.subAccessExpiresAt && new Date(sub.subAccessExpiresAt).getTime() <= Date.now();

  const loginUrl = `${window.location.origin}${VENDOR_HELPER_BASE}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <UserCog className="w-8 h-8 text-primary-600" />
            Sous-comptes
          </h1>
          <p className="text-gray-500 font-medium mt-1 text-sm">
            Créez des comptes assistants qui travaillent sur vos données, avec exactement les accès que vous leur donnez.
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={subAccounts.length >= maxSubAccounts}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold transition-all shadow-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Nouveau sous-compte
        </button>
      </div>

      <div className="bg-primary-50/60 border border-primary-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-primary-600 shrink-0" />
        <p className="text-sm text-primary-900/80 font-medium flex-1">
          Vos assistants se connectent avec leur propre email sur la page de connexion habituelle, puis arrivent sur{' '}
          <span className="font-mono font-bold">{VENDOR_HELPER_BASE}</span>. Ils ne peuvent jamais toucher à votre mot de
          passe, votre 2FA, vos coordonnées bancaires, vos retraits ni vos intégrations.
        </p>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(loginUrl);
            toast.success('Lien copié.');
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-primary-200 text-primary-700 text-xs font-bold hover:bg-primary-50 transition-colors shrink-0"
        >
          <Copy className="w-3.5 h-3.5" />
          Copier le lien
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        </div>
      ) : subAccounts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-primary-50 text-primary-600">
            <Users className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Aucun sous-compte</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Créez un assistant pour vous aider à traiter vos commandes, gérer vos liens ou répondre au support — sans
            partager vos identifiants.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors bg-primary-50 text-primary-600 hover:bg-primary-100"
          >
            <Plus className="w-5 h-5" />
            Créer mon premier sous-compte
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {subAccounts.map((sub) => (
            <div
              key={sub.uuid}
              className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 transition-all ${
                sub.isActive && !isExpired(sub) ? 'border-gray-100' : 'border-amber-200 bg-amber-50/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-black shrink-0">
                    {(sub.fullName || sub.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{sub.fullName || 'Sans nom'}</h3>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      <Mail className="w-3 h-3 shrink-0" />
                      {sub.email}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide shrink-0 ${
                    isExpired(sub)
                      ? 'bg-red-100 text-red-700'
                      : sub.isActive
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {isExpired(sub) ? 'Expiré' : sub.isActive ? 'Actif' : 'Suspendu'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600">
                  {MODE_LABELS[sub.subAllowedModes] || sub.subAllowedModes}
                </span>
                <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {grantedCount(sub)} / {ALL_SUB_PERMISSIONS.length} accès
                </span>
                {sub.subReadOnly && (
                  <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Lecture seule
                  </span>
                )}
                {/* Only shown when restricted: an unrestricted helper holds the
                    whole catalogue, and a "tous les produits" chip on every card
                    would be noise. */}
                {(sub.productIds || []).length > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {sub.productIds.length} produit{sub.productIds.length > 1 ? 's' : ''}
                  </span>
                )}
                {sub.subAccessExpiresAt && (
                  <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    {new Date(sub.subAccessExpiresAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
                {sub.phone && (
                  <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {sub.phone}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-gray-400 font-medium">
                {sub.lastLoginAt
                  ? `Dernière connexion : ${new Date(sub.lastLoginAt).toLocaleString('fr-FR')}`
                  : 'Jamais connecté'}
              </p>

              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <button
                  onClick={() => openEdit(sub)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary-50 text-primary-700 text-xs font-bold hover:bg-primary-100 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Accès
                </button>
                <button
                  onClick={() => {
                    setPasswordTarget(sub);
                    setNewPassword('');
                  }}
                  title="Changer le mot de passe"
                  className="p-2 rounded-xl text-gray-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleStatus(sub)}
                  title={sub.isActive ? 'Suspendre' : 'Réactiver'}
                  className={`p-2 rounded-xl transition-colors ${
                    sub.isActive
                      ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(sub)}
                  title="Supprimer"
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------ create / edit */}
      {editorOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <h2 className="text-lg font-black text-gray-900">
                  {editing ? `Accès de ${editing.fullName || editing.email}` : 'Nouveau sous-compte'}
                </h2>
                <button
                  onClick={() => setEditorOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">
                      Nom complet
                    </label>
                    <input
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none font-medium"
                      placeholder="Ex : Youssef B."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">
                      Téléphone (optionnel)
                    </label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none font-medium"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">
                      Email de connexion
                    </label>
                    <input
                      value={form.email}
                      disabled={!!editing}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none font-medium disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="assistant@exemple.com"
                    />
                  </div>
                  {!editing && (
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">
                        Mot de passe
                      </label>
                      <input
                        type="text"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none font-medium"
                        placeholder="8 caractères minimum"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-2">
                    Modes autorisés
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.keys(MODE_LABELS) as AllowedModes[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setForm((f) => ({ ...f, subAllowedModes: mode }))}
                        className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                          form.subAllowedModes === mode
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ------------------------------------------ account controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setForm((f) => ({ ...f, subReadOnly: !f.subReadOnly }))}
                    className={`flex items-start gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                      form.subReadOnly
                        ? 'bg-sky-50 border-sky-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Eye className={`w-5 h-5 mt-0.5 shrink-0 ${form.subReadOnly ? 'text-sky-600' : 'text-gray-300'}`} />
                    <span>
                      <span className="block text-sm font-bold text-gray-800">Mode lecture seule</span>
                      <span className="block text-xs text-gray-400 font-medium">
                        Il voit tout ce que vous lui accordez mais ne peut rien modifier.
                      </span>
                    </span>
                  </button>

                  <div className="px-4 py-3 rounded-2xl border border-gray-200 bg-white">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-1.5">
                      <CalendarClock className="w-4 h-4 text-gray-300" />
                      Fin d'accès (optionnel)
                    </label>
                    <input
                      type="datetime-local"
                      value={form.subAccessExpiresAt}
                      onChange={(e) => setForm((f) => ({ ...f, subAccessExpiresAt: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm font-medium"
                    />
                    <span className="block text-xs text-gray-400 font-medium mt-1">
                      Le compte cesse de fonctionner tout seul à cette date.
                    </span>
                  </div>
                </div>

                {/* ------------------------------------------------- products */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1">
                      Produits accessibles
                    </label>
                    <p className="text-xs text-gray-400 font-medium">
                      Choisissez ce que cet assistant peut voir et gérer. Les commandes, les liens de vente et les
                      statistiques suivent la même limite.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => setForm((f) => ({ ...f, restrictProducts: false }))}
                      className={`px-4 py-3 rounded-xl text-sm font-bold border text-left transition-all ${
                        !form.restrictProducts
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      Tout le catalogue
                      <span className="block text-xs font-medium opacity-70 mt-0.5">
                        Tous vos produits, présents et à venir.
                      </span>
                    </button>
                    <button
                      onClick={() => setForm((f) => ({ ...f, restrictProducts: true }))}
                      className={`px-4 py-3 rounded-xl text-sm font-bold border text-left transition-all ${
                        form.restrictProducts
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      Produits sélectionnés
                      <span className="block text-xs font-medium opacity-70 mt-0.5">
                        {form.productIds.length > 0
                          ? `${form.productIds.length} produit${form.productIds.length > 1 ? 's' : ''} choisi${
                              form.productIds.length > 1 ? 's' : ''
                            }.`
                          : 'Vous choisissez un par un.'}
                      </span>
                    </button>
                  </div>

                  {form.restrictProducts && (
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/70 border-b border-gray-100">
                        <Search className="w-4 h-4 text-gray-300 shrink-0" />
                        <input
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Rechercher un produit ou un SKU…"
                          className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-gray-300"
                        />
                        <button
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              productIds:
                                visibleProducts.length > 0 &&
                                visibleProducts.every((p) => f.productIds.includes(p.id))
                                  ? f.productIds.filter((id) => !visibleProducts.some((p) => p.id === id))
                                  : [...new Set([...f.productIds, ...visibleProducts.map((p) => p.id)])],
                            }))
                          }
                          className="text-[11px] font-bold text-primary-600 hover:text-primary-700 shrink-0"
                        >
                          {visibleProducts.length > 0 && visibleProducts.every((p) => form.productIds.includes(p.id))
                            ? 'Tout retirer'
                            : 'Tout sélectionner'}
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                        {!productsLoaded ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                          </div>
                        ) : visibleProducts.length === 0 ? (
                          <p className="px-4 py-10 text-center text-sm text-gray-400 font-medium">
                            {products.length === 0
                              ? "Vous n'avez encore aucun produit à partager."
                              : 'Aucun produit ne correspond à cette recherche.'}
                          </p>
                        ) : (
                          visibleProducts.map((product) => (
                            <label
                              key={product.id}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50/60 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={form.productIds.includes(product.id)}
                                onChange={() => toggleProduct(product.id)}
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
                              />
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt=""
                                  className="w-9 h-9 rounded-lg object-cover bg-gray-50 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                  <ImageOff className="w-4 h-4 text-gray-300" />
                                </div>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-gray-800 truncate">{product.name}</span>
                                <span className="block text-xs text-gray-400 font-medium truncate">
                                  {product.sku}
                                  {product.status !== 'APPROVED' && ` · ${product.status}`}
                                </span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {form.restrictProducts && (
                    <p className="text-xs text-gray-400 font-medium flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
                      Un nouveau produit ajouté plus tard à votre catalogue ne lui sera pas accordé automatiquement —
                      revenez ici pour le cocher.
                    </p>
                  )}
                </div>

                {/* ---------------------------------------------- permissions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wide">
                      Accès aux pages et actions — {grantedTotal} / {ALL_SUB_PERMISSIONS.length}
                    </p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setAll(true)} className="text-[11px] font-bold text-primary-600 hover:text-primary-700">
                        Tout accorder
                      </button>
                      <button onClick={() => setAll(false)} className="text-[11px] font-bold text-gray-400 hover:text-gray-600">
                        Tout retirer
                      </button>
                    </div>
                  </div>

                  {SUB_PERMISSION_GROUPS.map((group) => {
                    const keys = group.items.map((i) => i.key);
                    const allOn = keys.every((k) => form.permissions[k]);
                    return (
                      <div key={group.group} className="border border-gray-100 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/70">
                          <span className="text-xs font-black text-gray-700 uppercase tracking-wide">{group.group}</span>
                          <button
                            onClick={() => setGroup(keys, !allOn)}
                            className="text-[11px] font-bold text-primary-600 hover:text-primary-700"
                          >
                            {allOn ? 'Tout retirer' : 'Tout accorder'}
                          </button>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {group.items.map((item) => {
                            const blocked = !!item.requires && !form.permissions[item.requires];
                            return (
                              <label
                                key={item.key}
                                className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                                  item.requires ? 'pl-10' : ''
                                } ${blocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50/60'}`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={blocked}
                                  checked={!!form.permissions[item.key]}
                                  onChange={() => togglePermission(item.key)}
                                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
                                />
                                <span className="min-w-0">
                                  <span className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
                                    {item.label}
                                    {item.sensitive && (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Action sensible" />
                                    )}
                                  </span>
                                  <span className="block text-xs text-gray-400 font-medium">{item.hint}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setEditorOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Enregistrer' : 'Créer le sous-compte'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ------------------------------------------------------------ password */}
      {passwordTarget &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <h2 className="text-lg font-black text-gray-900">Nouveau mot de passe</h2>
                <button
                  onClick={() => setPasswordTarget(null)}
                  className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-3">
                <p className="text-sm text-gray-500 font-medium">
                  Pour <span className="font-bold text-gray-800">{passwordTarget.fullName || passwordTarget.email}</span>.
                  Communiquez-le lui directement — il ne sera plus affiché.
                </p>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none font-medium"
                  placeholder="8 caractères minimum"
                />
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setPasswordTarget(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSetPassword}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Mettre à jour
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
