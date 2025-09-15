'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import VenuesTab from './tabs/VenuesTab'
import TransactionsTab from './tabs/TransactionsTab'

interface AdminDashboardProps {
  activeTab: string
}

export default function AdminDashboard({ activeTab }: AdminDashboardProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleTabChange = (tab: string) => {
    // If we're on /admin, use replace to update the URL
    if (pathname === '/admin') {
      router.replace(`/admin/${tab}`)
    } else {
      router.push(`/admin/${tab}`)
    }
  }

  return (
    <div className="container mx-auto py-8">

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-400">
          <TabsTrigger value="venues">Venue Management</TabsTrigger>
          <TabsTrigger value="transactions">Transaction Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="venues">
          <VenuesTab />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}