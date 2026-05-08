import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { organization: true },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // Users who left their org cannot log in
        if (user.orgId === null) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: user.orgId,
          orgSlug: user.organization?.slug ?? null,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.orgId = (user as { orgId?: string }).orgId
        token.orgSlug = (user as { orgSlug?: string }).orgSlug
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.orgId = token.orgId as string | null
        session.user.orgSlug = token.orgSlug as string | null
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
