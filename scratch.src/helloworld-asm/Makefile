CC=arm-linux-gnueabi-gcc -static

all: helloworld.arm32

# debug helper: https://stackoverflow.com/questions/16467718/how-to-print-out-a-variable-in-makefile
# usage: $ make print-CC
print-%: ; @echo $* is $($*)

%.arm32: %.s
	$(CC) -o $@ $<

.PHONY: clean
clean:
	rm *.arm32
