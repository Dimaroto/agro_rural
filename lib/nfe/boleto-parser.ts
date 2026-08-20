/** Parser de boleto FEBRABAN (port Bedendo boleto_parser.dart). */

export type BoletoParseResult = {
  codigo: string;
  valorCents: number | null;
  vencimento: string | null; // YYYY-MM-DD
  banco: string | null;
  valido: boolean;
  mensagem: string | null;
};

function linhaToBarcode(linha: string): string {
  if (linha.length === 47) {
    const bancoMoeda = linha.slice(0, 4);
    const campoLivre =
      linha.slice(4, 9) + linha.slice(10, 20) + linha.slice(21, 31);
    const dv = linha.slice(32, 33);
    const fatorValor = linha.slice(33, 47);
    return `${bancoMoeda}${dv}${fatorValor}${campoLivre}`;
  }
  if (linha.length === 48) return linha.slice(0, 44);
  return linha.length >= 44 ? linha.slice(0, 44) : linha;
}

function dateFromFator(fator: number): string {
  const baseAntiga = new Date(1997, 9, 7);
  const dataAntiga = new Date(baseAntiga);
  dataAntiga.setDate(dataAntiga.getDate() + fator);

  let dataNova: Date;
  if (fator >= 1000) {
    dataNova = new Date(2025, 1, 22);
    dataNova.setDate(dataNova.getDate() + (fator - 1000));
  } else {
    dataNova = new Date(2025, 1, 22);
    dataNova.setDate(dataNova.getDate() + fator);
  }

  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear() - 2, hoje.getMonth(), hoje.getDate());
  const fim = new Date(hoje.getFullYear() + 10, hoje.getMonth(), hoje.getDate());
  const inWindow = (d: Date) => d >= inicio && d <= fim;

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  if (fator >= 1000 && inWindow(dataNova)) return fmt(dataNova);
  if (inWindow(dataAntiga)) return fmt(dataAntiga);
  if (fator >= 1000 && dataAntiga < new Date(2025, 1, 22)) return fmt(dataNova);
  return fmt(dataAntiga);
}

export function parseBoleto(raw: string): BoletoParseResult {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 44) {
    return {
      codigo: digits,
      valorCents: null,
      vencimento: null,
      banco: null,
      valido: false,
      mensagem:
        "Código incompleto. Informe a linha digitável ou o código de barras.",
    };
  }
  const barcode = digits.length >= 47 ? linhaToBarcode(digits) : digits;
  if (barcode.length < 44) {
    return {
      codigo: digits,
      valorCents: null,
      vencimento: null,
      banco: null,
      valido: false,
      mensagem: "Não foi possível interpretar o código do boleto.",
    };
  }
  const banco = barcode.slice(0, 3);
  const fatorVenc = Number(barcode.slice(5, 9)) || 0;
  const valorCents = Number(barcode.slice(9, 19)) || 0;
  return {
    codigo: digits,
    valorCents: valorCents > 0 ? valorCents : null,
    vencimento: fatorVenc > 0 ? dateFromFator(fatorVenc) : null,
    banco,
    valido: true,
    mensagem: null,
  };
}
