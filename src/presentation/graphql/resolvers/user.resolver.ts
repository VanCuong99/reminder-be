import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UserService } from '../../../application/services/users/user.service';
import { UserType } from '../types/user/outputs/user.type';
import { CreateUserInput } from '../types/user/inputs/create-user.input';
import { UpdateUserInput } from '../types/user/inputs/update-user.input';
import { PaginationInput } from '../../../shared/types/graphql/inputs/pagination.input';
import { PaginatedUsersResponse } from '../types/user/outputs/paginated-users.response';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/infrastructure/auth/guards/jwt-auth.guard';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { Roles } from 'src/infrastructure/auth/decorators/role.decorator';

@Resolver(() => UserType)
@UseGuards(JwtAuthGuard)
export class UserResolver {
    constructor(private readonly userService: UserService) {}

    @Query(() => PaginatedUsersResponse)
    @Roles(UserRole.ADMIN, UserRole.USER)
    async users(
        @Args('pagination', { nullable: true }) pagination?: PaginationInput,
    ): Promise<PaginatedUsersResponse> {
        return this.userService.findAll(pagination);
    }

    @Query(() => UserType, { nullable: true })
    @Roles(UserRole.ADMIN, UserRole.USER)
    async user(@Args('id') id: string): Promise<UserType> {
        return this.userService.findOne(id);
    }

    @Mutation(() => UserType)
    @Roles(UserRole.ADMIN)
    async createUser(@Args('input') input: CreateUserInput): Promise<UserType> {
        return this.userService.create(input);
    }

    @Mutation(() => UserType)
    @Roles(UserRole.ADMIN)
    async updateUser(
        @Args('id') id: string,
        @Args('input') updateUserInput: UpdateUserInput,
    ): Promise<UserType> {
        return this.userService.update(id, updateUserInput);
    }
}
