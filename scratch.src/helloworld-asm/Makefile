CC=arm-linux-gnueabi-gcc -static

all: helloworld.arm32

%.arm32: %.s
	$(CC) -o $@ $<

.PHONY: clean
clean:
	rm *.arm32
