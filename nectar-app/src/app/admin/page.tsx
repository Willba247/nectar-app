'use client'

import { useState, useEffect } from 'react'
import PasswordProtection from "./PasswordProtection"
import AdminDashboard from "./AdminDashboard"

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    useEffect(() => {
        const auth = localStorage.getItem('adminAuthenticated')
        if (auth === 'true') {
            setIsAuthenticated(true)
        }
    }, [])

    if (!isAuthenticated) {
        return <PasswordProtection onSuccess={() => setIsAuthenticated(true)} />
    }

    // Default to venues tab when accessing /admin directly
    return (
        <div>
            <AdminDashboard activeTab="venues" />
        </div>
    )
}
