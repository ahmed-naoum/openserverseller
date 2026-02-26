import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

interface CSVImporterProps {
  onImport: (data: any[]) => void;
  templateColumns: string[];
  maxRows?: number;
}

export default function CSVImporter({ onImport, templateColumns, maxRows = 1000 }: CSVImporterProps) {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseCSV = (text: string): { headers: string[]; rows: any[]; errors: string[] } => {
    const lines = text.split('\n').filter((line) => line.trim());
    const errors: string[] = [];

    if (lines.length === 0) {
      errors.push('Le fichier est vide');
      return { headers: [], rows: [], errors };
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headerLine = lines[0];
    const csvHeaders = headerLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
    
    const requiredColumns = templateColumns.map((c) => c.toLowerCase());
    const missingColumns = requiredColumns.filter(
      (col) => !csvHeaders.some((h) => h.includes(col) || col.includes(h))
    );

    if (missingColumns.length > 0) {
      errors.push(`Colonnes manquantes: ${missingColumns.join(', ')}`);
    }

    const rows: any[] = [];
    for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
      const values = lines[i].split(delimiter).map((v) => v.trim().replace(/["']/g, ''));
      const row: any = {};
      
      csvHeaders.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      row._rowNumber = i;

      if (!row.fullname && !row['full name'] && !row.nom) {
        errors.push(`Ligne ${i}: Nom manquant`);
        continue;
      }

      if (!row.phone && !row.telephone && !row.tel) {
        errors.push(`Ligne ${i}: Téléphone manquant`);
        continue;
      }

      rows.push({
        fullName: row.fullname || row['full name'] || row.nom,
        phone: normalizePhone(row.phone || row.telephone || row.tel),
        city: row.city || row.ville || '',
        address: row.address || row.adresse || '',
        whatsapp: row.whatsapp || '',
      });
    }

    return { headers: csvHeaders, rows, errors: errors.slice(0, 10) };
  };

  const normalizePhone = (phone: string): string => {
    let normalized = phone.replace(/[\s\-.]/g, '');
    if (normalized.startsWith('0')) {
      normalized = '+212' + normalized.slice(1);
    }
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    return normalized;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseCSV(text);
        
        setHeaders(result.headers);
        setParsedData(result.rows);
        setErrors(result.errors);
      } catch (error) {
        toast.error('Erreur lors de la lecture du fichier');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      toast.error('Erreur lors de la lecture du fichier');
      setIsProcessing(false);
    };

    reader.readAsText(file);
  }, [templateColumns, maxRows]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.csv', '.txt'],
    },
    maxFiles: 1,
  });

  const handleImport = () => {
    if (parsedData.length === 0) {
      toast.error('Aucune donnée à importer');
      return;
    }
    onImport(parsedData);
    setParsedData([]);
    setHeaders([]);
  };

  const downloadTemplate = () => {
    const template = templateColumns.join(',') + '\n' + 'John Doe,+212612345678,Casablanca,123 Rue Mohammed V';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {isProcessing ? (
            <p className="text-gray-600">Traitement en cours...</p>
          ) : isDragActive ? (
            <p className="text-primary-600">Déposez le fichier ici</p>
          ) : (
            <>
              <p className="text-gray-600">Glissez-déposez un fichier CSV ici, ou cliquez pour sélectionner</p>
              <p className="text-sm text-gray-400">Maximum {maxRows} lignes</p>
            </>
          )}
        </div>
      </div>

      {/* Template Download */}
      <button
        onClick={downloadTemplate}
        className="text-sm text-primary-600 hover:text-primary-700 underline"
      >
        Télécharger le modèle CSV
      </button>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">Erreurs détectées:</h4>
          <ul className="text-sm text-red-600 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {parsedData.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Aperçu des données</h4>
              <p className="text-sm text-gray-500">{parsedData.length} lignes valides</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setParsedData([]);
                  setHeaders([]);
                }}
                className="btn-secondary btn-sm"
              >
                Annuler
              </button>
              <button onClick={handleImport} className="btn-primary btn-sm">
                Importer ({parsedData.length})
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">#</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Nom</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Téléphone</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Ville</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedData.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 px-4 text-gray-400">{row._rowNumber}</td>
                    <td className="py-2 px-4 text-gray-900">{row.fullName}</td>
                    <td className="py-2 px-4 text-gray-600">{row.phone}</td>
                    <td className="py-2 px-4 text-gray-600">{row.city}</td>
                  </tr>
                ))}
                {parsedData.length > 10 && (
                  <tr>
                    <td colSpan={4} className="py-2 px-4 text-gray-500 text-center">
                      ...et {parsedData.length - 10} autres lignes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
