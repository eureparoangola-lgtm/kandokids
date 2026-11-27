"use client";

import { readSheet } from "read-excel-file/browser";
import { useState, useTransition } from "react";
import { guardianInviteMessage, parseCsv, parseStudentSheet, whatsappLink, type StudentImportRow } from "@kandokids/shared";
import { importStudents, type ImportResult } from "@/app/painel/alunos/actions";
import { inputClass, labelClass } from "./action-form";

const TEMPLATE = "Nome;Classe;Escola;Morada;Encarregado;Telefone;Parentesco\nAna Neto;3ª classe;Colégio Esperança;Kilamba, Bloco Q;Joana Neto;+244 931 000 001;Mãe\n";
const LABELS: Record<string, string> = {
  full_name: "Nome", grade: "Classe", school_name: "Escola", home_address: "Morada",
  guardian_name: "Encarregado", guardian_phone: "Telefone", relationship: "Parentesco",
};

export function StudentImport({ companyName, routes }: { companyName: string; routes: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<StudentImportRow[] | null>(null);
  const [recognized, setRecognized] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setFileError(null);
    setRows(null);
    setResult(null);
    if (!file) return;
    try {
      const data: unknown[][] = file.name.toLowerCase().endsWith(".csv") ? parseCsv(await file.text()) : await readSheet(file);
      const parsed = parseStudentSheet(data);
      if (parsed.missingName) return setFileError('Não encontrámos a coluna "Nome". Use o modelo abaixo.');
      if (!parsed.students.length) return setFileError("O ficheiro não tem alunos.");
      setRows(parsed.students);
      setRecognized(parsed.recognized);
    } catch {
      setFileError("Não foi possível ler o ficheiro. Use Excel (.xlsx) ou CSV.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className={labelClass}>Ficheiro Excel ou CSV
          <input type="file" accept=".xlsx,.csv" onChange={(e) => onFile(e.target.files?.[0])}
            className="mt-1 block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink-900 file:px-3 file:py-2 file:font-semibold file:text-white" />
        </label>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATE)}`} download="modelo-alunos-kandokids.csv"
          className="text-sm font-medium text-ink-700 underline underline-offset-4">Descarregar modelo</a>
      </div>
      <p className="text-xs text-slate-500">Colunas: Nome (obrigatória), Classe, Escola, Morada, Encarregado, Telefone, Parentesco. A ordem não importa.</p>
      {fileError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}

      {rows && !result?.created && (
        <div className="space-y-3">
          <p className="text-sm"><strong>{rows.length}</strong> alunos encontrados. Colunas reconhecidas: {recognized.map((k) => LABELS[k]).join(", ")}.</p>
          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{recognized.map((k) => <th key={k} className="px-3 py-2">{LABELS[k]}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>{recognized.map((k) => <td key={k} className="px-3 py-1.5">{r[k as keyof StudentImportRow]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {routes.length > 0 && (
            <label className={labelClass}>Adicionar todos à rota (opcional)
              <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className={`${inputClass} max-w-xs`}>
                <option value="">— Nenhuma —</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          )}
          <button disabled={pending} onClick={() => start(async () => setResult(await importStudents(rows, routeId || null)))}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-brand-400 disabled:opacity-60">
            {pending ? "A importar…" : `Importar ${rows.length} alunos`}
          </button>
        </div>
      )}
      {result?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>}

      {result?.created && (
        <div className="space-y-3">
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {result.created.length} alunos importados. Envie agora o convite a cada encarregado:
          </p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {result.created.map((s) => (
              <li key={s.student_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span><strong>{s.full_name}</strong>{s.guardian_name ? ` · ${s.guardian_name}` : ""}{s.invite_code ? <span className="ml-2 font-mono text-slate-500">{s.invite_code}</span> : null}</span>
                {s.invite_code && s.guardian_phone ? (
                  <a target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-3 py-1 font-semibold text-white hover:bg-green-700"
                    href={whatsappLink(s.guardian_phone, guardianInviteMessage({ company: companyName, student: s.full_name.split(" ")[0], code: s.invite_code, guardianName: s.guardian_name, origin: window.location.origin }))}>
                    Enviar por WhatsApp
                  </a>
                ) : <span className="text-slate-400">sem telefone</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
