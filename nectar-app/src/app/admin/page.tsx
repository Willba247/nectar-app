'use client'

import { useState, useEffect } from 'react'
import AdminPage from "./Admin"
import PasswordProtection from "./PasswordProtection"

export default function Page() {
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

    return (
        <div>
            <AdminPage />
        </div>
    )
}
