import React from 'react'

export default function KpiCard({ title, value, icon: Icon, tone = 'indigo' }) {
  const tones = {
    indigo: {
      from: 'from-indigo-50', to: 'to-indigo-100', border: 'border-indigo-200', text: 'text-indigo-900', label: 'text-indigo-600'
    },
    green: {
      from: 'from-green-50', to: 'to-green-100', border: 'border-green-200', text: 'text-green-900', label: 'text-green-600'
    },
    blue: {
      from: 'from-blue-50', to: 'to-blue-100', border: 'border-blue-200', text: 'text-blue-900', label: 'text-blue-600'
    },
    yellow: {
      from: 'from-yellow-50', to: 'to-yellow-100', border: 'border-yellow-200', text: 'text-yellow-900', label: 'text-yellow-600'
    },
    red: {
      from: 'from-red-50', to: 'to-red-100', border: 'border-red-200', text: 'text-red-900', label: 'text-red-600'
    }
  }
  const t = tones[tone] || tones.indigo

  return (
    <div className={`card bg-gradient-to-br ${t.from} ${t.to} ${t.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${t.label} font-medium`}>{title}</p>
          <p className={`text-3xl font-bold ${t.text} mt-1`}>{value}</p>
        </div>
        {Icon && <Icon className={`w-12 h-12 ${t.label} opacity-50`} />}
      </div>
    </div>
  )
}
