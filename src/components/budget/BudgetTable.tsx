
import React from 'react';
import { BudgetItem } from '@/types';
import { Trash2 } from 'lucide-react';

interface BudgetTableProps {
  items: BudgetItem[];
  isLocked: boolean;
  onRemove: (id: string) => void;
}

export const BudgetTable: React.FC<BudgetTableProps> = ({ items, isLocked, onRemove }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700 font-semibold">
          <tr>
            <th className="p-3 text-left">Descripción</th>
            <th className="p-3 text-right">Cant.</th>
            <th className="p-3 text-right">Precio</th>
            <th className="p-3 text-right">Total</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="p-3 font-medium text-slate-800">{item.descripcion}</td>
              <td className="p-3 text-right text-slate-600">{item.cantidad} {item.unidad}</td>
              <td className="p-3 text-right text-slate-600">${item.precio_unitario.toLocaleString()}</td>
              <td className="p-3 text-right font-bold text-slate-900">${item.total.toLocaleString()}</td>
              <td className="p-3 text-center">
                {!isLocked && (
                  <button type="button" onClick={() => onRemove(item.id)} className="text-slate-400 hover:text-red-500 transition">
                    <Trash2 size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">Agrega ítems manualmente o sube un archivo.</td></tr>
          )}
        </tbody>
        <tfoot className="bg-slate-50 border-t border-slate-200">
          <tr className="font-black text-lg">
            <td colSpan={3} className="p-4 text-right text-slate-600 uppercase tracking-tighter">Monto Final del Proyecto</td>
            <td className="p-4 text-right text-orange-600 font-black">
              ${items.reduce((sum, i) => sum + i.total, 0).toLocaleString()}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
