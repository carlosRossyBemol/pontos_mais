import React from "react";

interface ThermalReceiptProps {
  companyName: string;
  clientName: string;
  cpfOrCode: string;
  valorRetirado: number;
  saldoRestante: number;
  dataHora: string;
}

interface ReceiptContentProps extends ThermalReceiptProps {
  via: string;
  isLast?: boolean;
}

const ReceiptContent = ({
  companyName,
  clientName,
  cpfOrCode,
  valorRetirado,
  saldoRestante,
  dataHora,
  via,
  isLast = false,
}: ReceiptContentProps) => (
  <div
    className={`p-4 max-w-[80mm] mx-auto font-mono text-sm ${
      !isLast ? "page-break" : ""
    }`}
  >
    <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3">
      <h1 className="text-xl font-bold">PONTOS+</h1>
      <p className="text-xs font-bold mt-1">{companyName}</p>
      <p className="text-xs mt-1">COMPROVANTE DE RETIRADA</p>
      <p className="text-xs font-bold mt-1">{via}</p>
    </div>

    <div className="space-y-2 text-xs">
      <div className="flex justify-between">
        <span>Data/Hora:</span>
        <span className="font-bold">{dataHora}</span>
      </div>
      <div className="border-t border-dashed border-black pt-2 mt-2">
        <div className="flex justify-between">
          <span>Cliente:</span>
          <span className="font-bold">{clientName}</span>
        </div>
        <div className="flex justify-between">
          <span>CPF/Código:</span>
          <span className="font-bold">{cpfOrCode}</span>
        </div>
      </div>
      <div className="border-t border-dashed border-black pt-2 mt-2">
        <div className="flex justify-between text-lg">
          <span>Valor Retirado:</span>
          <span className="font-bold">R$ {valorRetirado.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Saldo Restante:</span>
          <span className="font-bold">R$ {saldoRestante.toFixed(2)}</span>
        </div>
      </div>
    </div>

    {via === "VIA LOJA - ASSINATURA DO CLIENTE" && (
      <div className="mt-6 pt-4 border-t border-dashed border-black">
        <p className="text-xs mb-8">Assinatura do Cliente:</p>
        <div className="border-t border-black w-full"></div>
      </div>
    )}

    <div className="text-center text-xs mt-4 pt-3 border-t-2 border-dashed border-black">
      <p>Obrigado pela preferência!</p>
    </div>
  </div>
);

export const ThermalReceipt = ({
  companyName,
  clientName,
  cpfOrCode,
  valorRetirado,
  saldoRestante,
  dataHora,
}: ThermalReceiptProps) => {
  return (
    <div className="thermal-receipt">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .thermal-receipt, .thermal-receipt * {
            visibility: visible;
          }
          .thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            font-family: 'Courier New', monospace;
            font-size: 12pt;
            color: black;
            background: white;
          }
          .page-break {
            page-break-after: always;
            break-after: page; 
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Via 1 - Para assinatura (loja) */}
      <ReceiptContent
        companyName={companyName}
        clientName={clientName}
        cpfOrCode={cpfOrCode}
        valorRetirado={valorRetirado}
        saldoRestante={saldoRestante}
        dataHora={dataHora}
        via="VIA LOJA - ASSINATURA DO CLIENTE"
      />
      {/* Via 2 - Para o cliente */}
      <ReceiptContent
        companyName={companyName}
        clientName={clientName}
        cpfOrCode={cpfOrCode}
        valorRetirado={valorRetirado}
        saldoRestante={saldoRestante}
        dataHora={dataHora}
        via="VIA CLIENTE"
        isLast
      />
    </div>
  );
};
