'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/trpc/react'
import toast from 'react-hot-toast'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'

type Transaction = {
  id: string;
  session_id: string;
  venue_id: string;
  customer_email: string;
  customer_name: string;
  payment_status: string;
  amount_total: number;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function TransactionsTab() {
  const [selectedTransactionVenue, setSelectedTransactionVenue] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [paymentStatus, setPaymentStatus] = useState<string>('all')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalTransactions, setTotalTransactions] = useState(0)

  const { data: venues } = api.venue.getAllVenues.useQuery()
  
  const getTransactions = api.transaction.getTransactions.useMutation({
    onSuccess: (result) => {
      setTransactions(result.data);
      setTotalTransactions(result.total);
      setIsGeneratingReport(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsGeneratingReport(false);
    }
  })

  // Load today's transactions by default
  useEffect(() => {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const startDateStr = startOfDay.toISOString().split('T')[0] ?? '';
    const endDateStr = endOfDay.toISOString().split('T')[0] ?? '';

    setStartDate(startDateStr);
    setEndDate(endDateStr);

    setIsGeneratingReport(true);
    getTransactions.mutate({
      start_date: startOfDay.toISOString(),
      end_date: endOfDay.toISOString(),
      limit: PAGE_SIZE,
      offset: 0
    });
  }, []);

  // Update transactions when filters change
  useEffect(() => {
    if (startDate || endDate || selectedTransactionVenue !== 'all' || paymentStatus !== 'all') {
      setCurrentPage(0); // Reset to first page on filter change
      setIsGeneratingReport(true);
      getTransactions.mutate({
        venue_id: selectedTransactionVenue === 'all' ? undefined : selectedTransactionVenue,
        payment_status: paymentStatus === 'all' ? undefined : paymentStatus,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        limit: PAGE_SIZE,
        offset: 0
      });
    }
  }, [startDate, endDate, selectedTransactionVenue, paymentStatus]);

  // Handle page changes
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setIsGeneratingReport(true);
    getTransactions.mutate({
      venue_id: selectedTransactionVenue === 'all' ? undefined : selectedTransactionVenue,
      payment_status: paymentStatus === 'all' ? undefined : paymentStatus,
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      end_date: endDate ? new Date(endDate).toISOString() : undefined,
      limit: PAGE_SIZE,
      offset: newPage * PAGE_SIZE
    });
  };

  const totalPages = Math.ceil(totalTransactions / PAGE_SIZE);

  const downloadCSV = () => {
    if (!transactions.length) {
      toast.error('No transactions to download');
      return;
    }

    const headers = ['Date', 'Venue', 'Customer', 'Email', 'Amount', 'Status'];

    const rows = transactions.map(transaction => [
      new Date(transaction.created_at).toLocaleString(),
      venues?.find(v => v.id === transaction.venue_id)?.name ?? 'Unknown Venue',
      transaction.customer_name,
      transaction.customer_email,
      `$${(transaction.amount_total / 100).toFixed(2)}`,
      transaction.payment_status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Transaction Reports</h2>
        <p className="text-gray-600">View and analyze payment transactions across all venues</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Select Venue</Label>
              <Select
                value={selectedTransactionVenue}
                onValueChange={setSelectedTransactionVenue}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Venues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues?.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select
                value={paymentStatus}
                onValueChange={setPaymentStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {getTransactions.isPending ? (
            <div className="text-center py-8">
              <div className="text-lg font-medium">Loading transactions...</div>
            </div>
          ) : transactions && transactions.length > 0 ? (
            <>
              {/* Transaction Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {transactions.filter(t => t.payment_status === 'paid').length}
                    </div>
                    <div className="text-sm text-gray-600">Successful Payments</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      ${(transactions
                        .filter(t => t.payment_status === 'paid')
                        .reduce((sum, t) => sum + t.amount_total, 0) / 100
                      ).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Total Revenue</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-gray-600">
                      {transactions.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Transactions</div>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions Table */}
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={`${transaction.id}-${transaction.created_at}`}>
                        <TableCell>
                          {new Date(transaction.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {venues?.find(v => v.id === transaction.venue_id)?.name ?? 'Unknown Venue'}
                        </TableCell>
                        <TableCell>{transaction.customer_name}</TableCell>
                        <TableCell>{transaction.customer_email}</TableCell>
                        <TableCell>${(transaction.amount_total / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : transaction.payment_status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.payment_status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center mt-4">
                {/* Pagination */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0 || getTransactions.isPending}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage + 1} of {totalPages || 1} ({totalTransactions} total)
                  </span>
                  <Button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1 || getTransactions.isPending}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  onClick={downloadCSV}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-lg font-medium text-gray-500 mb-2">No transactions found</div>
              <div className="text-gray-400">
                {transactions.length === 0 && isGeneratingReport 
                  ? "No transactions match the selected filters" 
                  : "No transactions available"
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}