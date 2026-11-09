/**
 * Browser-only date box: the native date picker doesn't work on the web, so this uses the browser's own
 * (a calendar on computers, the system date wheel on phones). Only render it when Platform.OS is 'web'.
 */
export function WebDateInput(props: { value: string; min?: string; onChange: (ymd: string) => void }) {
  return (
    <input
      type="date"
      value={props.value}
      min={props.min}
      required
      onChange={(e) => {
        // Empty when the user clears the box; keep the last good date instead
        if (e.target.value) props.onChange(e.target.value);
      }}
      style={{
        backgroundColor: '#fff',
        border: '1px solid #D5D9DE',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 16,
        fontFamily: 'inherit',
        color: '#000',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 44,
      }}
    />
  );
}
