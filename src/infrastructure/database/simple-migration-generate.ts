// filepath: c:\Users\VanCuong\QcStar\Momento_BE\src\infrastructure\database\simple-migration-generate.ts
import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Script đơn giản hóa việc tạo migration
 * Chỉ cần truyền tên migration mà không cần đường dẫn đầy đủ
 */
function generateMigration() {
    try {
        // Lấy tên migration từ arguments
        const migrationName = process.argv[2];

        if (!migrationName) {
            console.error(
                'Vui lòng cung cấp tên cho migration, ví dụ: pnpm run mg:gen TenMigration',
            );
            process.exit(1);
        }

        // Tạo đường dẫn đầy đủ cho migration
        const migrationPath = path.join('src/infrastructure/database/migrations', migrationName);

        // Hiển thị thông báo
        console.log(`Đang tạo migration với tên: ${migrationName}`);
        console.log(`Đường dẫn đầy đủ: ${migrationPath}`);

        // Thực thi lệnh TypeORM để tạo migration
        const command = `ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate -d src/infrastructure/database/data-source.ts ${migrationPath}`;

        console.log(`Đang thực thi: ${command}`);
        execSync(command, { stdio: 'inherit' });

        console.log(`\nMigration ${migrationName} đã được tạo thành công!`);
        console.log('Hãy kiểm tra nội dung file migration trước khi chạy để đảm bảo không có lỗi.');
    } catch (error) {
        console.error('Lỗi khi tạo migration:', error);
        process.exit(1);
    }
}

// Chạy function
generateMigration();
