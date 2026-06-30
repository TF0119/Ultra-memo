'use client';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: React.ReactNode;
	description?: React.ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	onConfirm: () => void;
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = '削除',
	cancelLabel = 'キャンセル',
	destructive = true,
	onConfirm,
}: ConfirmDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-sm gap-5 border-border/60 bg-card/95 backdrop-blur">
				<AlertDialogHeader>
					<AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
					{description && <AlertDialogDescription className="text-[13px] leading-relaxed">{description}</AlertDialogDescription>}
				</AlertDialogHeader>
				<AlertDialogFooter className="gap-2">
					<AlertDialogCancel className="h-8 px-3 text-xs">{cancelLabel}</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className={cn('h-8 px-3 text-xs', destructive && 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/40')}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
