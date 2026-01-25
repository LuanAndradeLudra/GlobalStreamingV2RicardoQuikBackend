import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, User, UserRole } from '@prisma/client';
import { UserService } from '../user/user.service';

export interface GoogleProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateGoogleUser(profile: GoogleProfile): Promise<User> {
    // Try to find user by provider + providerId
    let user = await this.userService.findByProviderId(
      profile.id,
      AuthProvider.GOOGLE,
    );

    if (user) {
      return user;
    }

    // Try to find user by email
    const email = profile.emails[0]?.value;
    if (email) {
      user = await this.userService.findByEmail(email);
      if (user) {
        // TODO: Update existing user with Google provider info
        // Update existing user with Google provider info
        // Note: This would require an update method in UserService
        // For now, we'll create a new user if email exists but provider doesn't match
        // In production, you might want to handle account linking differently
      }
    }

    // Create new user if not found
    if (!user) {
      user = await this.userService.create({
        email: email || `google_${profile.id}@example.com`,
        displayName: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value,
        provider: AuthProvider.GOOGLE,
        providerId: profile.id,
        role: UserRole.USER,
      });
    }

    return user;
  }

  async generateJwt(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  async validateJwtPayload(payload: any): Promise<User | null> {
    const user = await this.userService.findById(payload.sub);
    return user;
  }

  // ⚠️ MÉTODO TEMPORÁRIO APENAS PARA DESENVOLVIMENTO ⚠️
  async bypassLogin(userId: string): Promise<User | null> {
    return this.userService.findById(userId);
  }
}

