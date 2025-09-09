import prisma from "@repo/database";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { Request, Response } from "express";
import transporter from "../services/transporter";

const emailSchema = z.object({
    email: z.string().email("Please provide a valid email address")
});

export const sendMagicLink = async (req: Request, res: Response) => {
    try {
        // Validate email with Zod
        const result = emailSchema.safeParse(req.body);
        
        if (!result.success) {
            return res.status(400).json({
                error: result.error.issues[0]?.message
            });
        }
        
        const { email } = result.data;

        // Check if user exists or create new user
        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Create new user
            user = await prisma.user.create({
                data: {
                    email,
                    lastLoggedIn: new Date()
                }
            });
        } else {
            // Update existing user's last login
            user = await prisma.user.update({
                where: { email },
                data: {
                    lastLoggedIn: new Date()
                }
            });
        }

        // Generate JWT token for magic link
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            { expiresIn: '15m' }
        );

        // Create magic link
        const magicLink = `${process.env.BASE_URL || 'http://localhost:3001'}/auth/verify?token=${token}`;

        // Send email via Nodemailer
        const info = await transporter.sendMail({
            from: '"Verify before trading"<banerjeebihan456@gmail.com>',
            to: email,
            subject: 'Verify your email address to sign in to Trading Platform',
            html: `
                <h2>Sign in to your account</h2>
                <p>Click the button below to sign in:</p>
                <a href="${magicLink}" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Sign In
                </a>
                <p>Or copy this link: <a href="${magicLink}">${magicLink}</a></p>
                <p>This link expires in 15 minutes.</p>
            `
        });

        res.json({
            success: true,
            message: "Magic link sent to your email"
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
};

export const verifyToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                error: "Token is required"
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token as string, process.env.JWT_SECRET || "your-secret-key") as {
            userId: string,
            email: string
        };
        
        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Generate session token (longer expiration)
        const sessionToken = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            { expiresIn: '7d' }
        );

        // Set HTTP-only cookie
        res.cookie('auth_token', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: "Authentication successful",
            user: {
                id: user.id,
                email: user.email,
                lastLoggedIn: user.lastLoggedIn
            }
        });

    } catch (error: any) {
        console.error('Token verification error:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: "Token has expired"
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: "Invalid token"
            });
        }

        res.status(500).json({
            error: 'Internal server error'
        });
    }
};

export const logout = async (_req: Request, res: Response) => {
    res.clearCookie('auth_token');
    res.json({
        success: true,
        message: "Logged out successfully"
    });
};