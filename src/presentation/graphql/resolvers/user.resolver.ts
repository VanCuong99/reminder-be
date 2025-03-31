import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UserService } from '../../../application/services/user.service';
import { UserType } from '../types/user.type';
import { CreateUserInput } from '../types/create-user.input';

@Resolver(() => UserType)
export class UserResolver {
    constructor(private readonly userService: UserService) { }

    @Query(() => [UserType])
    async users(): Promise<UserType[]> {
        return this.userService.findAll();
    }

    @Query(() => UserType)
    async user(@Args('id') id: string): Promise<UserType> {
        return this.userService.findOne(id);
    }

    @Mutation(() => UserType)
    async createUser(@Args('input') input: CreateUserInput): Promise<UserType> {
        return this.userService.create(input);
    }
} 
