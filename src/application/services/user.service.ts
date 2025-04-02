import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { CreateUserInput } from '../../presentation/graphql/types/user/inputs/create-user.input';
import { UpdateUserInput } from '../../presentation/graphql/types/user/inputs/update-user.input';
import { PaginationInput } from '../../shared/types/graphql/inputs/pagination.input';
import { IPaginatedType } from '../../shared/types/graphql/outputs/pagination.response';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async findAll(pagination?: PaginationInput): Promise<IPaginatedType<User>> {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortDirection = 'DESC',
        } = pagination || {};

        const skip = (page - 1) * limit;

        const [items, total] = await this.userRepository.findAndCount({
            skip,
            take: limit,
            order: { [sortBy]: sortDirection },
        });

        const totalPages = Math.ceil(total / limit);

        return {
            items,
            total,
            page,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        };
    }

    async findOne(id: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID "${id}" not found`);
        }
        return user;
    }

    async create(createUserInput: CreateUserInput): Promise<User> {
        const hashedPassword = await bcrypt.hash(createUserInput.password, 10);
        const user = this.userRepository.create({
            ...createUserInput,
            password: hashedPassword,
        });
        return this.userRepository.save(user);
    }

    async update(id: string, updateUserInput: UpdateUserInput): Promise<User> {
        const user = await this.findOne(id);

        // Only hash password if it's being updated
        if (updateUserInput.password) {
            updateUserInput.password = await bcrypt.hash(updateUserInput.password, 10);
        }

        // Update only provided fields
        Object.assign(user, updateUserInput);

        return this.userRepository.save(user);
    }
}
