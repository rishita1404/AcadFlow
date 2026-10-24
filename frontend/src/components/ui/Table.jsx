import React from 'react';

export default function Table({ columns, rows, emptyMsg = 'No data', stickyHeader = false }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 14,
        fontFamily: 'var(--font-sans)',
      }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  padding: '10px 16px',
                  textAlign: col.align || 'left',
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  background: 'var(--bg)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                  position: stickyHeader ? 'sticky' : 'static',
                  top: 0,
                  zIndex: 1,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: 'center',
                  padding: '40px 16px',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  fontSize: 14,
                }}
              >
                {emptyMsg}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.key ?? i}
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    style={{
                      padding: '12px 16px',
                      textAlign: col.align || 'left',
                      color: 'var(--text)',
                      fontVariantNumeric: col.numeric ? 'tabular-nums' : 'normal',
                      verticalAlign: 'middle',
                    }}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
