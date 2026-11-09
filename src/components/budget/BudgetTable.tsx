import React, { useState } from 'react';
import { BudgetItem } from '@/types';
import { Trash2, Edit3, Check, X, Calculator } from 'lucide-react';

interface BudgetTableProps {
  items: BudgetItem[];
  isLocked: boolean;
  onRemove: (id: string) => void;
  onUpdate?: (id: string, updated: Partial<BudgetItem>) => void;
}

export const BudgetTable: React.FC<BudgetTableProps> = ({ 
  items, 
  isLocked, 
  onRemove,
  onUpdate 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BudgetItem | null>(null);

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!editForm || !onUpdate) return;
    onUpdate(editForm.id, {
      descripcion: editForm.descripcion,
      cantidad: Number(editForm.cantidad) || 1,
      unidad: editForm.unidad || 'un',
      precio_unitario: Number(editForm.precio_unitario) || 0,
      total: Number(editForm.total) || 0
    });
    setEditingId(null);
    setEditForm(null);
  };

  const handleEditChange = (field: keyof BudgetItem, val: any) => {
    if (!editForm) return;

    if (field === 'cantidad') {
      const cant = Number(val) || 0;
      const unitPrice = editForm.precio_unitario || 0;
      setEditForm({
        ...editForm,
        cantidad: cant,
        total: Math.round(cant * unitPrice)
      });
    } else if (field === 'precio_unitario') {
      const unitPrice = Number(val) || 0;
      const cant = editForm.cantidad || 0;
      setEditForm({
        ...editForm,
        precio_unitario: unitPrice,
        total: Math.round(cant * unitPrice)
      });
    } else if (field === 'total') {
      const tot = Number(val) || 0;
      const cant = editForm.cantidad || 1;
      setEditForm({
        ...editForm,
        total: tot,
        precio_unitario: cant > 0 ? Math.round(tot / cant) : tot
      });
    } else {
      setEditForm({
        ...editForm,
        [field]: val
      });
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-sm">
        <thead className="bg-slate-100/80 text-slate-700 font-bold text-xs uppercase tracking-wider">
          <tr>
            <th className="p-3 text-left">Descripción de la Partida</th>
            <th className="p-3 text-center w-28">Cant. / m²</th>
            <th className="p-3 text-right w-36">Precio Unitario</th>
            <th className="p-3 text-right w-40">Total</th>
            <th className="p-3 text-center w-24">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const isEditing = editingId === item.id && editForm !== null;

            if (isEditing) {
              return (
                <tr key={item.id} className="bg-emerald-50/50">
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={editForm.descripcion}
                      onChange={(e) => handleEditChange('descripcion', e.target.value)}
                      className="w-full p-2 bg-white border border-emerald-400 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Descripción de la partida..."
                    />
                  </td>
                  <td className="p-2.5 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={editForm.cantidad}
                        onChange={(e) => handleEditChange('cantidad', e.target.value)}
                        className="w-16 p-1.5 bg-white border border-emerald-400 rounded-lg text-xs font-bold text-center text-slate-800 outline-none"
                      />
                      <input
                        type="text"
                        value={editForm.unidad}
                        onChange={(e) => handleEditChange('unidad', e.target.value)}
                        className="w-10 p-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-bold text-center text-slate-600 outline-none uppercase"
                        placeholder="m²"
                      />
                    </div>
                  </td>
                  <td className="p-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        value={editForm.precio_unitario}
                        onChange={(e) => handleEditChange('precio_unitario', e.target.value)}
                        className="w-28 p-1.5 bg-white border border-emerald-400 rounded-lg text-xs font-bold text-right text-slate-800 outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-2.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        value={editForm.total}
                        onChange={(e) => handleEditChange('total', e.target.value)}
                        className="w-32 p-1.5 bg-white border border-emerald-500 rounded-lg text-xs font-black text-right text-emerald-800 outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={saveEdit}
                        title="Guardar cambios"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        title="Cancelar"
                        className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3 font-medium text-slate-800">
                  <div className="flex items-center gap-2">
                    {item.descripcion.includes('CASA MODELO') && (
                      <span className="text-[10px] font-black uppercase bg-slate-900 text-white px-1.5 py-0.5 rounded">
                        Base
                      </span>
                    )}
                    {item.descripcion.includes('PROMO') && (
                      <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Promo Gratis
                      </span>
                    )}
                    {item.descripcion.startsWith('[') && (
                      <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                        Mejora
                      </span>
                    )}
                    <span className="leading-snug">{item.descripcion}</span>
                  </div>
                </td>
                <td className="p-3 text-center text-slate-700 font-bold whitespace-nowrap">
                  {item.cantidad} <span className="text-slate-400 font-normal">{item.unidad}</span>
                </td>
                <td className="p-3 text-right text-slate-700 font-bold whitespace-nowrap font-mono">
                  ${item.precio_unitario.toLocaleString('es-CL')}
                </td>
                <td className="p-3 text-right font-black text-slate-900 whitespace-nowrap font-mono">
                  ${item.total.toLocaleString('es-CL')}
                </td>
                <td className="p-3 text-center">
                  {!isLocked && (
                    <div className="flex items-center justify-center gap-1.5">
                      {onUpdate && (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          title="Modificar ítem, cantidad, precio unitario o total"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <Edit3 size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        title="Eliminar partida"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                No hay partidas en el presupuesto. Selecciona un modelo base o marca mejoramientos adicionales.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
          <tr>
            <td colSpan={3} className="p-4 text-right text-slate-700 font-black text-xs uppercase tracking-wider">
              Monto Total Presupuestado (IVA Incluido)
            </td>
            <td className="p-4 text-right text-emerald-700 font-black text-lg font-mono">
              ${items.reduce((sum, i) => sum + i.total, 0).toLocaleString('es-CL')} CLP
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
