'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/trpc/react'

interface PasswordProtectionProps {
    onSuccess: () => void
}

export default function PasswordProtection({ onSuccess }: PasswordProtectionProps) {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const verifyPassword = api.auth.verifyAdminPassword.useMutation({
        onSuccess: (data) => {
            if (data.isValid) {
                localStorage.setItem('adminAuthenticated', 'true')
                onSuccess()
            } else {
                setError('Incorrect password')
            }
        },
        onError: (error) => {
            setError('Authentication failed: ' + error.message)
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        verifyPassword.mutate({ password })
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Admin Access</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </div>
                        <Button type="submit" className="w-full" disabled={verifyPassword.isPending}>
                            {verifyPassword.isPending ? 'Verifying...' : 'Enter'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
} 