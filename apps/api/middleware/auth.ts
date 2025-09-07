import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
    };
}

const authenticateUser = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({
                error: "Not authenticated"
            });
        }

        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || "your-secret-key"
        ) as any;
        
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
        
        next();
    } catch (error: any) {
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
        
        return res.status(401).json({
            error: "Authentication failed"
        });
    }
};

export { authenticateUser, AuthRequest };