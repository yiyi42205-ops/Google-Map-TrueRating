import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface IssuesSummaryProps {
  issues: {
    timeAnomaly: number;
    templateText: number;
    vague: number;
  };
}

export function IssuesSummary({ issues }: IssuesSummaryProps) {
  const data = [
    { name: '時間異常集中', count: issues.timeAnomaly, color: '#ef4444' },
    { name: '樣板文字', count: issues.templateText, color: '#f97316' },
    { name: '內容空泛', count: issues.vague, color: '#eab308' },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">AI 偵測問題分佈</h3>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-4 mt-4">
        {data.map((item, index) => (
          <div key={index} className="text-center">
            <div className="text-2xl font-bold" style={{ color: item.color }}>{item.count}</div>
            <div className="text-xs text-gray-600">{item.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
