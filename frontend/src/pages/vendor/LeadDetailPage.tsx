import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import { formatCurrency, formatDate, formatPhone, getStatusColor } from '../../utils';

export default function LeadDetailPage() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.list({}).then((res) => {
      const lead = res.data.data.leads.find((l: any) => l.id === id);
      return lead;
    }),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Prospect non trouvé</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    NEW: 'primary',
    ASSIGNED: 'purple',
    CONTACTED: 'warning',
    INTERESTED: 'success',
    NOT_INTERESTED: 'danger',
    CALLBACK_REQUESTED: 'orange',
    ORDERED: 'success',
    UNREACHABLE: 'gray',
    INVALID: 'danger',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.fullName}</h1>
          <p className="text-gray-500 mt-1">Détails du prospect</p>
        </div>
        <span className={`badge-${statusColors[data.status] || 'gray'} text-sm px-3 py-1`}>
          {data.status}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Informations de contact</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <span>📞</span>
              </div>
              <div>
                <div className="text-xs text-gray-500">Téléphone</div>
                <a href={`tel:${data.phone}`} className="font-medium text-gray-900 hover:text-primary-600">
                  {formatPhone(data.phone)}
                </a>
              </div>
            </div>
            {data.whatsapp && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span>💬</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">WhatsApp</div>
                  <a
                    href={`https://wa.me/${data.phone.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-green-600 hover:underline"
                  >
                    Envoyer un message
                  </a>
                </div>
              </div>
            )}
            {data.city && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span>📍</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Ville</div>
                  <div className="font-medium text-gray-900">{data.city}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Brand & Assignment */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Affectation</h3>
          <div className="space-y-3">
            {data.brand && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span>🏷️</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Marque</div>
                  <div className="font-medium text-gray-900">{data.brand.name}</div>
                </div>
              </div>
            )}
            {data.assignedAgent && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span>👤</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Agent assigné</div>
                  <div className="font-medium text-gray-900">{data.assignedAgent.fullName}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <span>📅</span>
              </div>
              <div>
                <div className="text-xs text-gray-500">Date de création</div>
                <div className="font-medium text-gray-900">{formatDate(data.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Probability */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Conversion</h3>
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-primary-600 mb-2">
              {data.conversionProbability || 0}%
            </div>
            <div className="text-sm text-gray-500">Probabilité de conversion</div>
          </div>
          {data.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Notes</div>
              <p className="text-sm text-gray-700">{data.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Actions rapides</h3>
        <div className="flex flex-wrap gap-3">
          <a href={`tel:${data.phone}`} className="btn-primary">
            📞 Appeler
          </a>
          <a
            href={`https://wa.me/${data.phone.replace('+', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            💬 WhatsApp
          </a>
          <button className="btn-outline">📝 Modifier le statut</button>
          <button className="btn-outline">📦 Créer une commande</button>
        </div>
      </div>
    </div>
  );
}
