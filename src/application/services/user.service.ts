import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { CreateUserInput } from '../../presentation/graphql/types/user/inputs/create-user.input';
import { UserType } from '../../presentation/graphql/types/user/outputs/user.type';
import { PaginationInput } from '../../shared/types/graphql/inputs/pagination.input';
import { IPaginatedType } from '../../shared/types/graphql/outputs/pagination.response';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    async findAll(pagination?: PaginationInput): Promise<IPaginatedType<UserType>> {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortDirection = 'DESC' } = pagination || {};

        const skip = (page - 1) * limit;

        const [items, total] = await this.userRepository.findAndCount({
            skip,
            take: limit,
            order: { [sortBy]: sortDirection }
        });

        const totalPages = Math.ceil(total / limit);

        return {
            items,
            total,
            page,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
        };
    }

    async findOne(id: string): Promise<UserType> {
        return this.userRepository.findOne({ where: { id } });
    }

    async create(userData: CreateUserInput): Promise<UserType> {
        const user = this.userRepository.create(userData);
        return this.userRepository.save(user);
    }
} 
