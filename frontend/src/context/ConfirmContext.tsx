import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  placeholder?: string;
  isPrompt?: boolean;
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: ConfirmOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const [inputValue, setInputValue] = useState("");
  const [resolveFn, setResolveFn] = useState<((value: any) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = (opts: ConfirmOptions) => {
    setOptions({ ...opts, isPrompt: false });
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolveFn(() => resolve);
    });
  };

  const prompt = (opts: ConfirmOptions) => {
    setOptions({ ...opts, isPrompt: true });
    setInputValue(opts.defaultValue || "");
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      setResolveFn(() => resolve);
    });
  };

  const handleClose = (confirmed: boolean) => {
    setOpen(false);
    if (resolveFn) {
      if (options.isPrompt) {
        resolveFn(confirmed ? inputValue : null);
      } else {
        resolveFn(confirmed);
      }
      setResolveFn(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose(false)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title || (options.isPrompt ? "Enter value" : "Are you sure?")}</AlertDialogTitle>
            {options.description && (
              <AlertDialogDescription>
                {options.description}
              </AlertDialogDescription>
            )}
            {options.isPrompt && (
              <div className="py-4">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={options.placeholder || "Enter text..."}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleClose(true);
                    }
                  }}
                  autoFocus
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClose(false)}>
              {options.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClose(true)}
              className={options.isPrompt ? "bg-primary hover:bg-primary/90 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {options.confirmText || (options.isPrompt ? "Ok" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};
