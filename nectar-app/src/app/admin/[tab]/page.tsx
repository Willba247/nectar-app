'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import PasswordProtection from "../PasswordProtection"
import AdminDashboard from "../AdminDashboard"

export default function AdminTabPage({ params }: { params: Promise<{ tab: string }> }) {
    const unwrappedParams = use(params)
    const tab = unwrappedParams.tab
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const router = useRouter()

    // Valid tabs
    const validTabs = ['venues', 'transactions']
    
    useEffect(() => {
        const auth = localStorage.getItem('adminAuthenticated')
        if (auth === 'true') {
            setIsAuthenticated(true)
        }
    }, [])

    useEffect(() => {
        // Redirect to venues tab if invalid tab
        if (!validTabs.includes(tab)) {
            router.push('/admin/venues')
        }
    }, [tab, router])

    if (!isAuthenticated) {
        return <PasswordProtection onSuccess={() => setIsAuthenticated(true)} />
    }

    if (!validTabs.includes(tab)) {
        return null // Will redirect
    }

    return (
        <div>
            <AdminDashboard activeTab={tab} />
        </div>
    )
}