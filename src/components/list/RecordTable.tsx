import type { FieldMetadata, MementoRecord } from "../../services/mementoApi";
import "./RecordTable.css";

interface RecordTableProps {
    fields : FieldMetadata[]
    records : MementoRecord[]
    loading :boolean
}

function formatValue(value : unknown): string {
    if (value === null || value === undefined || value === ''){
        return '-'
    }

    if (typeof value === 'boolean'){
        return value ? 'Yes' : 'No'
    }

    if(Array.isArray(value)){
        return value
        .map((item) => typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item),).join(', ')
    }

    if (typeof value === 'object'){
        return JSON.stringify(value)
    }
    return String(value)
}

export function RecordTable({
    fields,
    records,
    loading,
}:RecordTableProps){
    const visibleFields = fields.filter((field) => !field.hidden)

    return (
         <div className="record-table__scroll">
            <table className="record-table">
                <thead>
                <tr>
                    <th scope="col">ID</th>

                    {visibleFields.map((field) => (
                    <th key={field.fieldname} scope="col">
                        {field.label}
                    </th>
                    ))}
                </tr>
                </thead>

                <tbody>
                {loading && records.length === 0 && (
                    <tr>
                    <td
                        colSpan={visibleFields.length + 1}
                        className="record-table__message"
                    >
                        Loading records…
                    </td>
                    </tr>
                )}

                {!loading && records.length === 0 && (
                    <tr>
                    <td
                        colSpan={visibleFields.length + 1}
                        className="record-table__message"
                    >
                        No records found.
                    </td>
                    </tr>
                )}

                {records.map((record) => (
                    <tr key={record.name}>
                    <td>
                        <span className="record-table__identifier">
                        {record.name}
                        </span>
                    </td>

                    {visibleFields.map((field) => {
                        const value = record[field.fieldname]

                        return (
                        <td key={field.fieldname}>
                            {field.fieldname === 'status' && value != null ? (
                            <span className="record-table__status">
                                {formatValue(value)}
                            </span>
                            ) : (
                            <span
                                className="record-table__cell-value"
                                title={formatValue(value)}
                            >
                                {formatValue(value)}
                            </span>
                            )}
                        </td>
                        )
                    })}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}