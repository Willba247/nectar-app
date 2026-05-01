"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/date-formatters";

interface Transaction {
  sessionId: string;
  customerEmail: string | null;
  customerName: string | null;
  paymentStatus: string;
  amountTotal: number;
  createdAt: Date;
}

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
}

export function TransactionTable({
  transactions,
  isLoading,
}: TransactionTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <p>Loading transactions...</p>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <p>No transactions found</p>
      </div>
    );
  }

  const getStatusColor = (
    status: string,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const truncateSessionId = (sessionId: string, length: number = 8) => {
    return sessionId.length > length
      ? sessionId.substring(0, length) + "..."
      : sessionId;
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created At</TableHead>
            <TableHead>Customer Name</TableHead>
            <TableHead>Customer Email</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Session ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={`${transaction.sessionId}-${transaction.createdAt}`}>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(transaction.createdAt)}
              </TableCell>
              <TableCell>{transaction.customerName ?? "N/A"}</TableCell>
              <TableCell>{transaction.customerEmail ?? "N/A"}</TableCell>
              <TableCell className="text-right">
                ${(transaction.amountTotal / 100).toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusColor(transaction.paymentStatus)}>
                  {transaction.paymentStatus ?? "unknown"}
                </Badge>
              </TableCell>
              <TableCell>
                <span
                  title={transaction.sessionId}
                  className="cursor-help font-mono text-sm"
                >
                  {truncateSessionId(transaction.sessionId)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
